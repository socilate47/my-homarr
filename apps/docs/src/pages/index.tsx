import React from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

import styles from "./index.module.css";

const guides = [
  { title: "Get the lab connected", label: "SETUP", text: "Build Homarr, connect Proxmox, and choose where discovered services should appear.", to: "/docs/my-homarr/setup" },
  { title: "Give every service a home", label: "DISCOVERY", text: "Install one guest agent. Let it keep the addresses and service links up to date.", to: "/docs/advanced/discovery" },
  { title: "Make the board feel like mine", label: "PERSONALIZE", text: "My icons, my layout, and a background that fits the way I use the lab.", to: "/docs/my-homarr/dashboard" },
];

export default function Home() {
  return (
    <Layout title="My homelab, documented" description="socilate47’s personal Homarr build: Proxmox discovery, guest agents, service shortcuts and a dashboard made for the lab.">
      <main className={styles.home}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>SOCILATE47 / HOMELAB FIELD NOTES</p>
            <h1 id="home-title">Proxmox in view.<br />Services within reach.</h1>
            <p className={styles.lead}>My own Homarr build for keeping the lab easy to use. Find the VM, open the service, and keep the dashboard looking the way I want.</p>
            <div className={styles.actions}>
              <Link className={styles.primaryLink} to="/docs/my-homarr/setup">Set up My Homarr <span aria-hidden="true">↗</span></Link>
              <Link className={styles.secondaryLink} to="https://github.com/socilate47/my-homarr">Explore the code <span aria-hidden="true">↗</span></Link>
            </div>
            <p className={styles.note}>Proxmox inventory · Linux guest agents · My dashboard</p>
          </div>
          <aside className={styles.labBoard} aria-label="Illustrative homelab dashboard">
            <div className={styles.boardHeader}><span className={styles.boardMark} aria-hidden="true">M</span><div><strong>My Homarr</strong><span>Example dashboard</span></div><span className={styles.boardLabel}>MY LAB</span></div>
            <div className={styles.resourceRow}><span className={styles.resourceDot} aria-hidden="true" /><span>Proxmox inventory</span><code>VM → service</code></div>
            <div className={styles.tiles}>
              <div className={styles.tile}><span className={styles.tileIcon}>G</span><strong>Monitoring</strong><span>Grafana</span><code>:3000</code></div>
              <div className={styles.tile}><span className={styles.tileIcon}>S</span><strong>Media</strong><span>Sonarr</span><code>:8989</code></div>
              <div className={styles.tile}><span className={styles.tileIcon}>H</span><strong>Home</strong><span>Home Assistant</span><code>:8123</code></div>
            </div>
            <div className={styles.boardFooter}><span>One place to open the lab.</span><span aria-hidden="true">↗</span></div>
          </aside>
        </section>
        <section className={styles.guides} aria-labelledby="guides-title">
          <div className={styles.sectionHeader}><p className={styles.eyebrow}>THE FIELD GUIDE</p><h2 id="guides-title">From a new VM to a useful shortcut.</h2><p>The notes I need to run this build, connect the guests, and make it my own.</p></div>
          <div className={styles.guideGrid}>{guides.map((guide) => <Link key={guide.label} to={guide.to} className={styles.guide}><span className={styles.guideLabel}>{guide.label}</span><h3>{guide.title}</h3><p>{guide.text}</p><span className={styles.guideAction}>Read the guide <span aria-hidden="true">↗</span></span></Link>)}</div>
        </section>
        <section className={styles.projectNote} aria-labelledby="project-title"><div><p className={styles.eyebrow}>ABOUT THIS BUILD</p><h2 id="project-title">A personal fork, built on Homarr.</h2></div><div><p>This is the documentation for <strong>socilate47/my-homarr</strong>. The discovery workflow and setup notes describe this build; the integration and widget reference retains its upstream Homarr origins.</p><Link to="/about-us">What belongs to this project <span aria-hidden="true">↗</span></Link></div></section>
      </main>
    </Layout>
  );
}
