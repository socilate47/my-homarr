package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"
)

type service struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	URL        string  `json:"url"`
	Port       *int    `json:"port"`
	Protocol   string  `json:"protocol"`
	Icon       *string `json:"icon"`
	Group      *string `json:"group"`
	Source     string  `json:"source"`
	Online     bool    `json:"online"`
	LastSeenAt string  `json:"lastSeenAt"`
}

type heartbeat struct {
	Token       string    `json:"token"`
	ResourceID  string    `json:"resourceId"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Node        string    `json:"node"`
	Status      string    `json:"status"`
	IPAddresses []string  `json:"ipAddresses"`
	Services    []service `json:"services"`
}

var knownPorts = map[int]string{
	80:    "Web service",
	443:   "Web service",
	3000:  "Grafana",
	5000:  "TrueNAS",
	8006:  "Proxmox",
	8123:  "Home Assistant",
	8080:  "Web service",
	8989:  "Sonarr",
	7878:  "Radarr",
	32400: "Plex",
	9000:  "Portainer",
	9443:  "Portainer",
}

func main() {
	server := requiredEnv("HOMARR_URL")
	token := requiredEnv("HOMARR_DISCOVERY_TOKEN")
	resourceID := requiredEnv("DISCOVERY_RESOURCE_ID")
	name := requiredEnv("DISCOVERY_NAME")
	resourceType := envOrDefault("DISCOVERY_TYPE", "qemu")
	node := envOrDefault("DISCOVERY_NODE", "")
	interval, err := time.ParseDuration(envOrDefault("DISCOVERY_INTERVAL", "60s"))
	if err != nil || interval < 10*time.Second {
		panic("DISCOVERY_INTERVAL must be at least 10s")
	}

	for {
		ips := localIPs()
		if err := sendHeartbeat(server, heartbeat{
			Token: token, ResourceID: resourceID, Name: name,
			Type: resourceType, Node: node, Status: "running",
			IPAddresses: ips, Services: discoverServices(ips),
		}); err != nil {
			fmt.Fprintf(os.Stderr, "heartbeat failed: %v\n", err)
		}
		time.Sleep(interval)
	}
}

func sendHeartbeat(server string, payload heartbeat) error {
	body, err := json.Marshal(map[string]any{"json": payload})
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 10 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		req, err := http.NewRequest(http.MethodPost, strings.TrimRight(server, "/")+"/api/trpc/discovery.heartbeat", bytes.NewReader(body))
		if err != nil {
			return err
		}
		req.Header.Set("content-type", "application/json")
		resp, err := client.Do(req)
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if resp.StatusCode < http.StatusBadRequest {
				return nil
			}
			lastErr = fmt.Errorf("server returned %s", resp.Status)
		} else {
			lastErr = err
		}
		if attempt < 2 {
			time.Sleep(time.Duration(attempt+1) * time.Second)
		}
	}
	return lastErr
}

func localIPs() []string {
	var result []string
	interfaces, _ := net.Interfaces()
	for _, iface := range interfaces {
		name := strings.ToLower(iface.Name)
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 ||
			strings.HasPrefix(name, "docker") || strings.HasPrefix(name, "br-") ||
			strings.HasPrefix(name, "veth") || strings.HasPrefix(name, "cni") ||
			strings.HasPrefix(name, "flannel") || strings.HasPrefix(name, "virbr") {
			continue
		}
		addresses, _ := iface.Addrs()
		for _, address := range addresses {
			ip, _, err := net.ParseCIDR(address.String())
			if err == nil && usableIP(ip.String()) {
				result = append(result, ip.String())
			}
		}
	}
	sort.Strings(result)
	return result
}

func usableIP(value string) bool {
	ip := net.ParseIP(value)
	return ip != nil && !ip.IsLoopback() && !ip.IsLinkLocalUnicast() && !ip.IsLinkLocalMulticast() && !ip.IsUnspecified()
}

func selectHostAddress(ips []string, override string) string {
	if override != "" && usableIP(override) {
		for _, ip := range ips {
			if ip == override {
				return override
			}
		}
	}
	for _, ip := range ips {
		if parsed := net.ParseIP(ip); usableIP(ip) && parsed.To4() != nil {
			return ip
		}
	}
	for _, ip := range ips {
		if usableIP(ip) {
			return ip
		}
	}
	return "127.0.0.1"
}

func serviceURL(protocol, host string, port int) string {
	return fmt.Sprintf("%s://%s", protocol, net.JoinHostPort(host, strconv.Itoa(port)))
}

func discoverServices(ips []string) []service {
	now := time.Now().UTC().Format(time.RFC3339)
	host := selectHostAddress(ips, os.Getenv("DISCOVERY_ADDRESS"))
	byID := make(map[string]service)
	for _, port := range listeningPorts() {
		name := knownPorts[port]
		if name == "" || host == "127.0.0.1" {
			continue
		}
		protocol := "http"
		if port == 443 || port == 8443 || port == 9443 {
			protocol = "https"
		}
		icon := strings.ToLower(strings.ReplaceAll(name, " ", "-"))
		byID[fmt.Sprintf("host-port-%d", port)] = service{
			ID: fmt.Sprintf("host-port-%d", port), Name: name,
			URL:  serviceURL(protocol, host, port),
			Port: &port, Protocol: protocol, Icon: &icon,
			Source: "agent", Online: true, LastSeenAt: now,
		}
	}
	for _, item := range discoverDockerServices(ips) {
		byID[item.ID] = item
	}
	result := make([]service, 0, len(byID))
	for _, item := range byID {
		result = append(result, item)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result
}

func discoverDockerServices(ips []string) []service {
	output, err := exec.Command("docker", "ps", "--format", "{{json .}}").Output()
	if err != nil {
		return nil
	}

	host := selectHostAddress(ips, os.Getenv("DISCOVERY_ADDRESS"))

	var result []service
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		if line == "" {
			continue
		}
		var container struct {
			ID     string `json:"ID"`
			Names  string `json:"Names"`
			Labels string `json:"Labels"`
			Ports  string `json:"Ports"`
		}
		if err := json.Unmarshal([]byte(line), &container); err != nil {
			continue
		}
		labels := parseLabels(container.Labels)
		if labels["homarr.discovery.enable"] == "false" {
			continue
		}
		ports := publishedPorts(container.Ports)
		if len(ports) == 0 || host == "127.0.0.1" {
			continue
		}
		name := labels["homarr.discovery.name"]
		if name == "" {
			name = container.Names
		}
		icon := labels["homarr.discovery.icon"]
		group := labels["homarr.discovery.group"]
		for _, port := range ports {
			protocol := "http"
			if override := labels["homarr.discovery.protocol"]; override == "https" {
				protocol = override
			} else if port == 443 || port == 8443 || port == 9443 {
				protocol = "https"
			}
			serviceName := name
			if len(ports) > 1 {
				serviceName = fmt.Sprintf("%s (%d)", name, port)
			}
			if labels["homarr.discovery.enable"] != "true" && knownPorts[port] == "" {
				continue
			}
			result = append(result, service{
				ID: fmt.Sprintf("docker-%s-%d", strings.Trim(strings.ToLower(container.Names), "/"), port), Name: serviceName,
				URL:  serviceURL(protocol, host, port),
				Port: &port, Protocol: protocol, Icon: optionalString(icon),
				Group: optionalString(group), Source: "agent", Online: true,
				LastSeenAt: time.Now().UTC().Format(time.RFC3339),
			})
		}
	}
	return result
}

func parseLabels(value string) map[string]string {
	labels := make(map[string]string)
	for _, label := range strings.Split(value, ",") {
		key, value, ok := strings.Cut(label, "=")
		if ok {
			labels[key] = value
		}
	}
	return labels
}

func publishedPorts(value string) []int {
	var ports []int
	seen := make(map[int]bool)
	for _, part := range strings.Split(value, ", ") {
		if !strings.Contains(part, "->") {
			continue
		}
		mapping := strings.SplitN(part, "->", 2)
		if !strings.HasSuffix(mapping[1], "/tcp") {
			continue
		}
		hostPort := mapping[0]
		if index := strings.LastIndex(hostPort, ":"); index >= 0 {
			hostPort = hostPort[index+1:]
		}
		port, err := strconv.Atoi(hostPort)
		if err == nil && port > 0 && port < 65536 && !seen[port] {
			ports = append(ports, port)
			seen[port] = true
		}
	}
	sort.Ints(ports)
	return ports
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func listeningPorts() []int {
	seen := make(map[int]bool)
	var ports []int
	for _, filename := range []string{"/proc/net/tcp", "/proc/net/tcp6"} {
		data, err := os.ReadFile(filename)
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(data), "\n")[1:] {
			fields := strings.Fields(line)
			if len(fields) < 4 || fields[3] != "0A" {
				continue
			}
			endpoint := strings.Split(fields[1], ":")
			if len(endpoint) != 2 || isLoopbackSocket(endpoint[0]) {
				continue
			}
			port, err := strconv.ParseInt(endpoint[1], 16, 32)
			if err == nil && port > 0 && port < 65536 && !seen[int(port)] {
				ports = append(ports, int(port))
				seen[int(port)] = true
			}
		}
	}
	sort.Ints(ports)
	return ports
}

func isLoopbackSocket(address string) bool {
	decoded, err := hex.DecodeString(address)
	if err != nil {
		return false
	}
	for start := 0; start < len(decoded); start += 4 {
		end := start + 4
		if end > len(decoded) {
			end = len(decoded)
		}
		for left, right := start, end-1; left < right; left, right = left+1, right-1 {
			decoded[left], decoded[right] = decoded[right], decoded[left]
		}
	}
	return net.IP(decoded).IsLoopback()
}

func requiredEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic(errors.New("missing " + key))
	}
	return value
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
