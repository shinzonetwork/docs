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
    {
      type: "category",
      label: "Indexer",
      link: { type: "doc", id: "indexer/overview" },
      items: [
        "indexer/quickstart",
        "indexer/faq"
      ],
    },
    {
      type: "category",
      label: "Host",
      link: { type: "doc", id: "hosts/overview" },
      items: [
        "hosts/quickstart", 
        "hosts/examples"
      ],
    },
    {
      type: "category",
      label: "View Creator",
      link: { type: "doc", id: "view-creator/overview" },
      items: [
        "view-creator/quickstart"
      ],
    },
    {
      type: "category",
      label: "Guides",
      items: ["guides/building-apps-with-shinzo"],
    },
    {
      type: "link",
      label: "Glossary",
      href: "/glossary",
    },
  ],
};

export default sidebars;
