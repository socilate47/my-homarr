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
