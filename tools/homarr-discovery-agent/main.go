package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

type service struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	URL         string  `json:"url"`
	Port        *int    `json:"port"`
	Protocol    string  `json:"protocol"`
	Icon        *string `json:"icon"`
	Group       *string `json:"group"`
	Source      string  `json:"source"`
	Online      bool    `json:"online"`
	LastSeenAt  string  `json:"lastSeenAt"`
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
		if err := sendHeartbeat(server, heartbeat{
			Token:       token, ResourceID: resourceID, Name: name,
			Type: resourceType, Node: node, Status: "running",
			IPAddresses: localIPs(), Services: discoverServices(localIPs()),
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
	req, err := http.NewRequest(http.MethodPost, strings.TrimRight(server, "/")+"/api/trpc/discovery.heartbeat", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("server returned %s", resp.Status)
	}
	return nil
}

func localIPs() []string {
	var result []string
	interfaces, _ := net.Interfaces()
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addresses, _ := iface.Addrs()
		for _, address := range addresses {
			ip, _, err := net.ParseCIDR(address.String())
			if err == nil && !ip.IsLoopback() {
				result = append(result, ip.String())
			}
		}
	}
	return result
}

func discoverServices(ips []string) []service {
	if services := discoverDockerServices(ips); len(services) > 0 {
		return services
	}

	ports := listeningPorts()
	now := time.Now().UTC().Format(time.RFC3339)
	result := make([]service, 0, len(ports))
	host := "127.0.0.1"
	if len(ips) > 0 {
		for _, ip := range ips {
			if strings.Contains(ip, ".") {
				host = ip
				break
			}
		}
	}
	for _, port := range ports {
		name := knownPorts[port]
		if name == "" {
			name = fmt.Sprintf("Port %d", port)
		}
		protocol := "http"
		if port == 443 || port == 8443 || port == 9443 {
			protocol = "https"
		}
		icon := strings.ToLower(strings.ReplaceAll(name, " ", "-"))
		result = append(result, service{
			ID: fmt.Sprintf("port-%d", port), Name: name,
			URL: fmt.Sprintf("%s://%s", protocol, net.JoinHostPort(host, strconv.Itoa(port))),
			Port: &port, Protocol: protocol, Icon: &icon,
			Source: "agent", Online: true, LastSeenAt: now,
		})
	}
	return result
}

func discoverDockerServices(ips []string) []service {
	output, err := exec.Command("docker", "ps", "--format", "{{json .}}").Output()
	if err != nil {
		return nil
	}

	host := "127.0.0.1"
	for _, ip := range ips {
		if strings.Contains(ip, ".") {
			host = ip
			break
		}
	}

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
		port := firstPublishedPort(container.Ports)
		if port == 0 {
			continue
		}
		name := labels["homarr.discovery.name"]
		if name == "" {
			name = container.Names
		}
		protocol := labels["homarr.discovery.protocol"]
		if protocol != "https" {
			protocol = "http"
		}
		icon := labels["homarr.discovery.icon"]
		group := labels["homarr.discovery.group"]
		result = append(result, service{
			ID: container.ID, Name: name,
			URL: fmt.Sprintf("%s://%s", protocol, net.JoinHostPort(host, strconv.Itoa(port))),
			Port: &port, Protocol: protocol, Icon: optionalString(icon),
			Group: optionalString(group), Source: "agent", Online: true,
			LastSeenAt: time.Now().UTC().Format(time.RFC3339),
		})
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

func firstPublishedPort(value string) int {
	for _, part := range strings.Split(value, ", ") {
		if !strings.Contains(part, "->") {
			continue
		}
		hostPort := strings.SplitN(part, "->", 2)[0]
		hostPort = strings.TrimSpace(strings.TrimPrefix(hostPort, "0.0.0.0:"))
		hostPort = strings.TrimPrefix(hostPort, "[::]:")
		port, err := strconv.Atoi(hostPort)
		if err == nil && port > 0 && port < 65536 {
			return port
		}
	}
	return 0
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func listeningPorts() []int {
	data, err := os.ReadFile("/proc/net/tcp")
	if err != nil {
		return nil
	}
	var ports []int
	for _, line := range strings.Split(string(data), "\n")[1:] {
		fields := strings.Fields(line)
		if len(fields) < 4 || fields[3] != "0A" {
			continue
		}
		parts := strings.Split(fields[1], ":")
		if len(parts) != 2 {
			continue
		}
		port, err := strconv.ParseInt(parts[1], 16, 32)
		if err == nil && port > 0 && port < 65536 {
			ports = append(ports, int(port))
		}
	}
	return ports
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
