import React from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

export default function AboutThisBuild() {
  return (
    <Layout title="About this build" description="My Homarr is socilate47’s personal Homarr fork for a Proxmox homelab.">
      <main className="container margin-vert--xl" style={{ maxWidth: 820 }}>
        <p style={{ fontFamily: "var(--ifm-font-family-monospace)", color: "var(--ifm-color-primary)", fontSize: 12 }}>SOCILATE47 / MY HOMARR</p>
        <h1>A personal build for my homelab.</h1>
        <p>I use this fork to bring Proxmox machines and their services into one dashboard, without memorizing every IP address and port. The names, icons, layout and background can match the way I run the lab.</p>
        <h2>What this fork adds</h2>
        <ul><li>Proxmox VM and LXC discovery with guest-agent service reports.</li><li>Automatic service tiles that preserve customization.</li><li>Agent downloads served by the Homarr instance.</li><li>A deployment script, setup notes and video wallpapers.</li></ul>
        <h2>What comes from upstream</h2>
        <p>My Homarr is based on the open-source Homarr project. Its dashboard foundation, widgets, many integrations and technical reference material come from that project and its contributors. Original attribution and license files are retained.</p>
        <p><Link to="https://github.com/socilate47/my-homarr">My repository</Link> · <Link to="https://github.com/homarr-labs/homarr">Upstream Homarr</Link> · <Link to="/docs/community/license">License reference</Link></p>
        <h2>Start with the lab notes</h2>
        <p><Link to="/docs/my-homarr/setup">Connect the lab</Link>, then <Link to="/docs/my-homarr/dashboard">make the dashboard mine</Link>.</p>
      </main>
    </Layout>
  );
}
