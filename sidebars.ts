import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  shinzoSidebar: [
    "intro",
    "supported-networks",
    {
      type: "category",
      label: "Indexer",
      items: ["indexer/overview","indexer/quickstart"],
    },
    {
      type: "category",
      label: "Host",
      items: ["hosts/overview","hosts/quickstart", "hosts/examples"],
    },
    {
      type: "category",
      label: "View Creator",
      items: ["view-creator/overview","view-creator/quickstart"],
    },
    {
      type: "category",
      label: "Guides",
      items: ["guides/building-apps-with-shinzo"],
    },
    "tokenomics",
    "glossary",
  ],
};

export default sidebars;
