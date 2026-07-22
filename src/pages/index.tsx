import Link from "@docusaurus/Link";
import platformTags from "@site/src/data/platformTags.json";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./index.module.css";

function HomepageHeader() {
  return (
    <header className={styles.hero}>
      <div className="container">
        <p className={styles.eyebrow}>0x00 — devlog</p>
        <Heading as="h1" className={styles.heroTitle}>
          Building a C++ game engine
          <br />
          from scratch
        </Heading>
        <p className={styles.heroSubtitle}>
          Zero heap allocations. Deterministic. Data-oriented. One engine, from
          retro to modern.
        </p>

        {platformTags.length > 0 && (
          <>
            <div className={styles.platformBar}>
              {platformTags.map((platform) => (
                <Link
                  key={platform.tag}
                  to={`/blog/tags/${platform.tag}`}
                  className={styles.platformSegment}
                  style={{
                    flex: platform.count,
                    background: platform.color,
                    color: platform.textColor,
                  }}
                >
                  {platform.label}
                </Link>
              ))}
            </div>
            <p className={styles.platformCaption}>posts by platform</p>
          </>
        )}

        <div className={styles.buttons}>
          <Link
            className={clsx("button button--lg", styles.buttonPrimary)}
            to="/blog"
          >
            Read the devlog
          </Link>
          <Link
            className={clsx("button button--lg", styles.buttonSecondary)}
            to="/docs/architecture/overview"
          >
            Browse the docs
          </Link>
        </div>
      </div>
    </header>
  );
}

type Principle = {
  marker: string;
  title: string;
  description: string;
};

const principles: Principle[] = [
  {
    marker: "0x01",
    title: "Zero-heap runtime",
    description: "No allocations in hot paths, no exceptions, no RTTI.",
  },
  {
    marker: "0x02",
    title: "Data-oriented ECS",
    description: "Entities as component collections in data configs.",
  },
  {
    marker: "0x03",
    title: "Cross-platform from day one",
    description: "GBA to Switch, both game projects, from the start.",
  },
];

function HomepagePrinciples() {
  return (
    <section className={styles.principles}>
      <div className={clsx("container", styles.principlesGrid)}>
        {principles.map((principle) => (
          <div key={principle.marker} className={styles.principleCard}>
            <p className={styles.principleMarker}>{principle.marker}</p>
            <Heading as="h3" className={styles.principleTitle}>
              {principle.title}
            </Heading>
            <p className={styles.principleDescription}>
              {principle.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="toygine2"
      description="A custom C++ game engine devlog — building a 3D action-RPG and 2D platformer engine from GBA to Switch"
    >
      <HomepageHeader />
      <main>
        <HomepagePrinciples />
      </main>
    </Layout>
  );
}
