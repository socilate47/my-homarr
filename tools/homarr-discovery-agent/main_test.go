package main

import "testing"

func TestSelectHostAddressSkipsLoopbackAndLinkLocal(t *testing.T) {
	got := selectHostAddress([]string{"127.0.0.1", "169.254.10.2", "10.0.0.7", "fd00::7"}, "")
	if got != "10.0.0.7" {
		t.Fatalf("selectHostAddress() = %q, want LAN IPv4 10.0.0.7", got)
	}
}

func TestSelectHostAddressHonorsValidOverride(t *testing.T) {
	got := selectHostAddress([]string{"10.0.0.7", "fd00::7"}, "fd00::7")
	if got != "fd00::7" {
		t.Fatalf("selectHostAddress() = %q, want override fd00::7", got)
	}
}

func TestSelectHostAddressRejectsUnusableOverride(t *testing.T) {
	got := selectHostAddress([]string{"10.0.0.7"}, "127.0.0.1")
	if got != "10.0.0.7" {
		t.Fatalf("selectHostAddress() = %q, want fallback 10.0.0.7", got)
	}
}

func TestServiceURLFormatsIPv6(t *testing.T) {
	got := serviceURL("https", "fd00::7", 8443)
	if got != "https://[fd00::7]:8443" {
		t.Fatalf("serviceURL() = %q, want bracketed IPv6 URL", got)
	}
}

func TestPublishedPortsReturnsEveryTCPEndpoint(t *testing.T) {
	got := publishedPorts("0.0.0.0:8080->80/tcp, :::8443->443/tcp, 0.0.0.0:53->53/udp")
	if len(got) != 2 || got[0] != 8080 || got[1] != 8443 {
		t.Fatalf("publishedPorts() = %#v, want [8080 8443]", got)
	}
}

func TestDockerEndpointsExcludeLoopback(t *testing.T) {
	endpoints := parsePublishedEndpoints("127.0.0.1:8080->80/tcp, [::1]:8443->443/tcp, 0.0.0.0:12345->80/tcp")
	if len(endpoints) != 1 || endpoints[0].port != 12345 || endpoints[0].containerPort != 80 {
		t.Fatalf("unexpected reachable endpoints: %#v", endpoints)
	}
}

func TestDockerWebPortUsesPublishedPortAndStableIdentity(t *testing.T) {
	output := []byte(`{"ID":"instance-one","Names":"my-web","Labels":"","Ports":"0.0.0.0:12345->80/tcp"}`)
	first := dockerServicesFromOutput(output, []string{"10.0.0.7"})
	second := dockerServicesFromOutput([]byte(`{"ID":"instance-two","Names":"my-web","Labels":"","Ports":"0.0.0.0:12345->80/tcp"}`), []string{"10.0.0.8"})
	if len(first) != 1 || len(second) != 1 {
		t.Fatalf("expected one service: %#v / %#v", first, second)
	}
	if first[0].ID != second[0].ID || second[0].URL != "http://10.0.0.8:12345" {
		t.Fatalf("service did not keep identity and update address: %#v", second)
	}
}

func TestProcLoopbackAddresses(t *testing.T) {
	for _, address := range []string{"0100007F", "00000000000000000000000001000000"} {
		if !isLoopbackSocket(address) {
			t.Errorf("expected loopback for %s", address)
		}
	}
	if isLoopbackSocket("00000000") {
		t.Error("wildcard listener must remain discoverable")
	}
}

func TestBoundHostListenersUseTheirOwnAddress(t *testing.T) {
	services := hostServicesFromEndpoints([]listeningEndpoint{{ip: "10.0.0.8", port: 3000}, {ip: "fd00::8", port: 8080}}, []string{"10.0.0.7", "10.0.0.8", "fd00::8"})
	if len(services) != 2 || services[0].URL != "http://10.0.0.8:3000" || services[1].URL != "http://[fd00::8]:8080" {
		t.Fatalf("wrong URLs for bound listeners: %#v", services)
	}
}

func TestDockerBindingsHaveDistinctServiceIdentities(t *testing.T) {
	output := []byte(`{"Names":"web","Labels":"homarr.discovery.enable=true","Ports":"10.0.0.7:8080->80/tcp, 10.0.0.8:8080->8080/tcp"}`)
	services := dockerServicesFromOutput(output, []string{"10.0.0.7", "10.0.0.8"})
	if len(services) != 2 || services[0].ID == services[1].ID {
		t.Fatalf("distinct endpoints need distinct IDs: %#v", services)
	}
}

func TestConfiguredNativeWebServicesUseDetectedAddresses(t *testing.T) {
	t.Setenv("DISCOVERY_WEB_SERVICES", `[{"name":"My frontend","port":5173,"protocol":"http"},{"name":"Admin console","port":10443,"protocol":"https"}]`)
	services := hostServicesFromEndpoints([]listeningEndpoint{{ip: "0.0.0.0", port: 5173}, {ip: "10.0.0.8", port: 10443}}, []string{"10.0.0.7", "10.0.0.8"})
	if len(services) != 2 {
		t.Fatalf("expected declared services, got %#v", services)
	}
	if services[0].Name != "My frontend" || services[0].URL != "http://10.0.0.7:5173" {
		t.Fatalf("wrong frontend: %#v", services[0])
	}
	if services[1].Protocol != "https" || services[1].URL != "https://10.0.0.8:10443" {
		t.Fatalf("wrong admin console: %#v", services[1])
	}
}
