package main

import (
	"bytes"
	"context"
	"crypto/sha256"
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
	Token                 string    `json:"token"`
	ResourceID            string    `json:"resourceId"`
	Name                  string    `json:"name"`
	Type                  string    `json:"type"`
	Node                  string    `json:"node"`
	Status                string    `json:"status"`
	IPAddresses           []string  `json:"ipAddresses"`
	Services              []service `json:"services"`
	ReportIntervalSeconds int       `json:"reportIntervalSeconds"`
}

var knownPorts = map[int]string{
	80:    "Web service",
	443:   "Web service",
	8443:  "Web service",
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
	if err != nil || interval < 10*time.Second || interval > 24*time.Hour {
		panic("DISCOVERY_INTERVAL must be between 10s and 24h")
	}
	if _, err := parseNativeWebServices(os.Getenv("DISCOVERY_WEB_SERVICES")); err != nil {
		panic(err)
	}

	for {
		ips := localIPs()
		if err := sendHeartbeat(server, heartbeat{
			Token: token, ResourceID: resourceID, Name: name,
			Type: resourceType, Node: node, Status: "running",
			IPAddresses: ips, Services: discoverServices(ips),
			ReportIntervalSeconds: int(interval / time.Second),
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
	result := make([]string, 0)
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
	return ip != nil && !ip.IsLoopback() && !ip.IsLinkLocalUnicast() && !ip.IsMulticast() && !ip.IsUnspecified()
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

type listeningEndpoint struct {
	ip   string
	port int
}

type nativeWebService struct {
	Name     string `json:"name"`
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
}

func parseNativeWebServices(value string) (map[int]nativeWebService, error) {
	result := make(map[int]nativeWebService)
	if strings.TrimSpace(value) == "" {
		return result, nil
	}
	var entries []nativeWebService
	if err := json.Unmarshal([]byte(value), &entries); err != nil {
		return nil, errors.New("DISCOVERY_WEB_SERVICES must be a JSON array of names, ports and HTTP/HTTPS protocols")
	}
	if len(entries) > 256 {
		return nil, errors.New("DISCOVERY_WEB_SERVICES supports at most 256 services")
	}
	for _, entry := range entries {
		entry.Name = strings.TrimSpace(entry.Name)
		entry.Protocol = strings.ToLower(strings.TrimSpace(entry.Protocol))
		if entry.Protocol == "" {
			entry.Protocol = "http"
		}
		if entry.Name == "" || len(entry.Name) > 200 || entry.Port < 1 || entry.Port > 65535 || (entry.Protocol != "http" && entry.Protocol != "https") {
			return nil, errors.New("DISCOVERY_WEB_SERVICES entries need a name, a port between 1 and 65535, and protocol http or https")
		}
		if _, exists := result[entry.Port]; exists {
			return nil, errors.New("DISCOVERY_WEB_SERVICES cannot declare the same port more than once")
		}
		result[entry.Port] = entry
	}
	return result, nil
}

func bindingIdentity(ip string) string {
	parsed := net.ParseIP(ip)
	if parsed == nil || parsed.IsUnspecified() {
		return "any"
	}
	interfaces, _ := net.Interfaces()
	for _, iface := range interfaces {
		addresses, _ := iface.Addrs()
		for index, address := range addresses {
			candidate, _, err := net.ParseCIDR(address.String())
			if err == nil && candidate.Equal(parsed) {
				return fmt.Sprintf("%s-%d", iface.Name, index)
			}
		}
	}
	return ip
}

func hostServicesFromEndpoints(endpoints []listeningEndpoint, ips []string) []service {
	result := make([]service, 0)
	seen := make(map[string]bool)
	declared, _ := parseNativeWebServices(os.Getenv("DISCOVERY_WEB_SERVICES"))
	for _, endpoint := range endpoints {
		port := endpoint.port
		name := knownPorts[port]
		protocol := "http"
		if port == 443 || port == 8443 || port == 9443 || port == 8006 {
			protocol = "https"
		}
		if custom, exists := declared[port]; exists {
			name, protocol = custom.Name, custom.Protocol
		}
		if name == "" {
			continue
		}
		parsed := net.ParseIP(endpoint.ip)
		if parsed == nil || parsed.IsLoopback() || parsed.IsLinkLocalUnicast() {
			continue
		}
		host := endpoint.ip
		if parsed.IsUnspecified() {
			candidates := ips
			if parsed.To4() != nil {
				candidates = nil
				for _, ip := range ips {
					if candidate := net.ParseIP(ip); candidate != nil && candidate.To4() != nil {
						candidates = append(candidates, ip)
					}
				}
			}
			host = selectHostAddress(candidates, os.Getenv("DISCOVERY_ADDRESS"))
		} else {
			belongsToGuest := false
			for _, ip := range ips {
				if candidate := net.ParseIP(ip); candidate != nil && candidate.Equal(parsed) {
					belongsToGuest = true
				}
			}
			if !belongsToGuest {
				continue
			}
		}
		if !usableIP(host) {
			continue
		}
		url := serviceURL(protocol, host, port)
		if seen[url] {
			continue
		}
		seen[url] = true
		icon := strings.ToLower(strings.ReplaceAll(name, " ", "-"))
		iconValue := &icon
		if _, custom := declared[port]; custom || name == "Web service" {
			iconValue = nil
		}
		result = append(result, service{ID: fmt.Sprintf("host-%s-%d", bindingIdentity(host), port), Name: name, URL: url, Port: &port, Protocol: protocol, Icon: iconValue, Source: "agent", Online: true, LastSeenAt: time.Now().UTC().Format(time.RFC3339)})
	}
	return result
}

func discoverServices(ips []string) []service {
	byID := make(map[string]service)
	for _, item := range hostServicesFromEndpoints(listeningEndpoints(), ips) {
		byID[item.ID] = item
	}
	for _, item := range discoverDockerServices(ips) {
		for id, existing := range byID {
			if strings.SplitN(existing.URL, "://", 2)[1] == strings.SplitN(item.URL, "://", 2)[1] {
				delete(byID, id)
			}
		}
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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, "docker", "ps", "--format", "{{json .}}").Output()
	if err != nil {
		return nil
	}

	return dockerServicesFromOutput(output, ips)
}

func dockerServicesFromOutput(output []byte, ips []string) []service {
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
		ports := parsePublishedEndpoints(container.Ports)
		if len(ports) == 0 || host == "127.0.0.1" {
			continue
		}
		name := labels["homarr.discovery.name"]
		if name == "" {
			name = container.Names
		}
		icon := labels["homarr.discovery.icon"]
		group := labels["homarr.discovery.group"]
		for _, endpoint := range ports {
			port := endpoint.port
			serviceHost := host
			if parsed := net.ParseIP(endpoint.host); parsed != nil && !parsed.IsUnspecified() {
				serviceHost = endpoint.host
			}
			protocol := "http"
			if override := labels["homarr.discovery.protocol"]; override == "https" || override == "http" {
				protocol = override
			} else if endpoint.containerPort == 443 || port == 443 || port == 8443 || port == 9443 || port == 8006 {
				protocol = "https"
			}
			serviceName := name
			if len(ports) > 1 {
				serviceName = fmt.Sprintf("%s (%d)", name, port)
			}
			if labels["homarr.discovery.enable"] != "true" && knownPorts[port] == "" && knownPorts[endpoint.containerPort] == "" {
				continue
			}
			result = append(result, service{
				ID: dockerEndpointID(container.Names, endpoint), Name: serviceName,
				URL:  serviceURL(protocol, serviceHost, port),
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

type publishedEndpoint struct {
	host          string
	port          int
	containerPort int
}

func parsePublishedEndpoints(value string) []publishedEndpoint {
	var ports []publishedEndpoint
	seen := make(map[string]bool)
	for _, part := range strings.Split(value, ", ") {
		if !strings.Contains(part, "->") {
			continue
		}
		mapping := strings.SplitN(part, "->", 2)
		if !strings.HasSuffix(mapping[1], "/tcp") {
			continue
		}
		hostPort := mapping[0]
		host := ""
		if index := strings.LastIndex(hostPort, ":"); index >= 0 {
			host = strings.Trim(hostPort[:index], "[]")
			hostPort = hostPort[index+1:]
		}
		if parsed := net.ParseIP(host); parsed != nil && (parsed.IsLoopback() || parsed.IsLinkLocalUnicast()) {
			continue
		}
		port, err := strconv.Atoi(hostPort)
		innerPort, innerErr := strconv.Atoi(strings.TrimSuffix(mapping[1], "/tcp"))
		keyHost := host
		if parsed := net.ParseIP(host); parsed != nil && parsed.IsUnspecified() {
			keyHost = ""
		}
		key := fmt.Sprintf("%s:%d", keyHost, port)
		if err == nil && innerErr == nil && innerPort > 0 && innerPort < 65536 && port > 0 && port < 65536 && !seen[key] {
			ports = append(ports, publishedEndpoint{host: host, port: port, containerPort: innerPort})
			seen[key] = true
		}
	}
	sort.Slice(ports, func(i, j int) bool { return ports[i].port < ports[j].port })
	return ports
}

func publishedPorts(value string) []int {
	var result []int
	for _, endpoint := range parsePublishedEndpoints(value) {
		result = append(result, endpoint.port)
	}
	return result
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func listeningEndpoints() []listeningEndpoint {
	seen := make(map[string]bool)
	var endpoints []listeningEndpoint
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
			parts := strings.Split(fields[1], ":")
			if len(parts) != 2 {
				continue
			}
			address := decodeSocketAddress(parts[0])
			if address == nil || address.IsLoopback() || address.IsLinkLocalUnicast() {
				continue
			}
			port, err := strconv.ParseInt(parts[1], 16, 32)
			key := fmt.Sprintf("%s:%d", address.String(), port)
			if err == nil && port > 0 && port < 65536 && !seen[key] {
				endpoints = append(endpoints, listeningEndpoint{ip: address.String(), port: int(port)})
				seen[key] = true
			}
		}
	}
	return endpoints
}

func decodeSocketAddress(address string) net.IP {
	decoded, err := hex.DecodeString(address)
	if err != nil || (len(decoded) != 4 && len(decoded) != 16) {
		return nil
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
	return net.IP(decoded)
}

func isLoopbackSocket(address string) bool { return decodeSocketAddress(address).IsLoopback() }

func dockerEndpointID(name string, endpoint publishedEndpoint) string {
	value := fmt.Sprintf("%s/%s/%d/%d", strings.Trim(name, "/"), bindingIdentity(endpoint.host), endpoint.port, endpoint.containerPort)
	hash := sha256.Sum256([]byte(value))
	return fmt.Sprintf("docker-%x", hash[:12])
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
