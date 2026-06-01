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
    {
      type: "category",
      label: "Introduction",
      items: [
        "introduction/what-is-shinzo/index",
        "introduction/how-it-works/index",
        "introduction/core-concepts/index"
      ],
    },
    {
      type: "category",
      label: "Indexer",
      items: [
        "indexer/overview",
        "indexer/install",
        "indexer/register",
        "indexer/faq"
      ],
    },
    {
      type: "category",
      label: "Host",
      items: [
        "hosts/overview", 
        "hosts/quickstart", 
        "hosts/examples"
      ],
    },
    {
      type: "category",
      label: "View Creator",
      items: [
        "view-creator/overview",
        "view-creator/quickstart"
      ],
    },
    {
      type: "category",
      label: "Guides",
      items: [
        "guides/building-apps-with-shinzo"
      ],
    },
    {
      type: "category",
      label: "Reference",
      items: [
        "reference/architecture-overview/index",
        "reference/tools/index",
        {
          type: "category",
          label: "Components",
          items: [
            "reference/components/host-client/index",
            "reference/components/indexer-client/index",
            "reference/components/outpost/index",
            "reference/components/relayer/index",
            "reference/components/shinzohub/index",
            "reference/components/viewkit/index",
          ],
        },
        {
          type: "link",
          label: "Glossary",
          href: "/reference/glossary",
        },
      ],
    },
  ],
};

export default sidebars;
