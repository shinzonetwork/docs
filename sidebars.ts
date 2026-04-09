import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  shinzoSidebar: [
    {
      type: "category",
      label: "Introduction",
      collapsible: false,
      items: [
        "introduction/what-is-shinzo",
        "introduction/how-it-works",
        "introduction/core-concepts",
        "introduction/whitepaper",
      ],
    },
    {
      type: "category",
      label: "Guides",
      collapsible: false,
      items: [
        {
          type: "category",
          label: "Run an Indexer",
          items: [
            "guides/run-an-indexer/overview",
            "guides/run-an-indexer/getting-started",
            "guides/run-an-indexer/supported-networks",
            "guides/run-an-indexer/security",
            "guides/run-an-indexer/faq",
          ],
        },
        {
          type: "category",
          label: "Run a Host",
          items: [
            "guides/run-a-host/overview",
            "guides/run-a-host/getting-started",
            "guides/run-a-host/economics-and-earnings",
          ],
        },
        {
          type: "category",
          label: "Build a View",
          items: [
            "guides/build-a-view/what-is-a-view",
            "guides/build-a-view/tutorial-build-your-first-view",
            "guides/build-a-view/viewkit-cli-reference",
            "guides/build-a-view/deploy-to-shinzohub",
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Reference",
      collapsible: false,
      items: [
        "reference/architecture-overview",
        {
          type: "category",
          label: "Components",
          items: [
            "reference/components/indexer-client",
            "reference/components/host-client",
            "reference/components/view-creator-viewkit",
            "reference/components/shinzohub",
            "reference/components/outpost",
            "reference/components/relayer",
          ],
        },
        {
          type: "category",
          label: "Standards",
          items: [
            "reference/standards/svs-1",
            "reference/standards/svps-1",
            "reference/standards/viewbundle-vwl-format",
          ],
        },
        "reference/shinzohub-api",
        "reference/supported-networks",
      ],
    },
    {
      type: "category",
      label: "Economics",
      collapsible: false,
      items: [
        "economics/shnz-token",
        "economics/indexer-earnings",
        "economics/host-earnings-and-pricing",
        "economics/staking-and-slashing",
      ],
    },
    {
      type: "category",
      label: "Roadmap",
      collapsible: false,
      items: [
        "roadmap/scheduler",
        "roadmap/network-gateway",
        "roadmap/shinzo-studio",
      ],
    },
    {
      type: "category",
      label: "Contributing",
      collapsible: false,
      items: [
        {
          type: "category",
          label: "ADRs",
          items: [
            "contributing/adrs/chain-abstraction-migration",
            "contributing/adrs/indexing-at-the-tip",
          ],
        },
        "contributing/pr-guidelines",
        "contributing/onboarding",
      ],
    },
    {
      type: "category",
      label: "Resources",
      collapsible: false,
      items: [
        {
          type: "link",
          label: "Glossary",
          href: "/glossary",
        },
      ],
    },
  ],
};

export default sidebars;
