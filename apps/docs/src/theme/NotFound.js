import React from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

export default function NotFound() {
  return <Layout title="Page not found"><main className="container margin-vert--xl" style={{ maxWidth: 740 }}><p style={{ fontFamily: "var(--ifm-font-family-monospace)", color: "var(--ifm-color-primary)" }}>MY HOMARR / 404</p><h1>This page isn’t in the lab notes.</h1><p>Check the address or return to the setup guide.</p><Link className="button button--primary" to="/docs/my-homarr">Go to My Homarr</Link></main></Layout>;
}
