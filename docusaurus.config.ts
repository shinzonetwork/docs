import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { codeTheme } from "./src/code-theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const glossaryPlugin = require("docusaurus-plugin-glossary");

const glossaryOptions = {
  glossaryPath: "glossary/glossary.json",
  routePath: "/reference/glossary",
};

const config: Config = {
  title: "Shinzō Developer Portal",
  tagline: "Build the Read Layer of Truth",
  url: "https://docs.shinzo.network",
  baseUrl: "/",
  favicon: "img/favicon.png",

  // Plausible Analytics
  scripts: [
    {
      src: "https://plausible.source.network/js/script.js",
      defer: true,
      "data-domain": "docs.shinzo.network",
    },
  ],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true,
  },

  organizationName: "shinzonetwork",
  projectName: "shinzo-docs",

  onBrokenLinks: "warn",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
    mermaid: true,
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          path: "./content",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          sidebarCollapsible: false,
          remarkPlugins: [
            glossaryPlugin.getRemarkPlugin(glossaryOptions, {
              siteDir: __dirname,
            }),
          ],
        },
        theme: {
          customCss: "./src/css/custom.scss",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    mermaid: {
      // Use the "base" theme so themeVariables fully take effect.
      theme: { light: "base", dark: "base" },
      options: {
        fontSize: 16,
        fontFamily: '"Geist", sans-serif',
        flowchart: {
          useMaxWidth: false,
          htmlLabels: true,
          curve: "basis",
        },
        sequence: {
          useMaxWidth: false,
          actorFontFamily: '"Geist Mono", monospace',
          messageFontFamily: '"Geist", sans-serif',
          noteFontFamily: '"Geist", sans-serif',
        },
        themeVariables: {
          // Shinzo brand palette
          primaryColor: "#ffe9e9",
          primaryTextColor: "#353535",
          primaryBorderColor: "#d01f27",

          secondaryColor: "#f3f3f3",
          secondaryTextColor: "#353535",
          secondaryBorderColor: "#c7c7c7",

          tertiaryColor: "#ffffff",
          tertiaryTextColor: "#353535",
          tertiaryBorderColor: "#c7c7c7",

          // Lines and arrows
          lineColor: "#353535",
          textColor: "#353535",

          // Backgrounds
          background: "#ffffff",
          mainBkg: "#ffe9e9",
          secondBkg: "#f3f3f3",

          // Notes
          noteBkgColor: "#fff8d6",
          noteTextColor: "#353535",
          noteBorderColor: "#c7c7c7",

          // Sequence diagrams
          actorBkg: "#ffe9e9",
          actorBorder: "#d01f27",
          actorTextColor: "#353535",
          actorLineColor: "#c7c7c7",
          signalColor: "#353535",
          signalTextColor: "#353535",
          labelBoxBkgColor: "#ffe9e9",
          labelBoxBorderColor: "#d01f27",
          labelTextColor: "#353535",
          loopTextColor: "#353535",

          // Flowchart clusters / subgraphs
          clusterBkg: "#fafafa",
          clusterBorder: "#c7c7c7",

          // Edge label
          edgeLabelBackground: "#ffffff",
        },
      },
    },
    docs: {
      sidebar: {},
    },
    colorMode: {
      respectPrefersColorScheme: false,
      defaultMode: "light",
      disableSwitch: true, // TEMPORARY: dark mode toggle disabled
    },
    navbar: {
      hideOnScroll: false,
      logo: {
        alt: "Shinzo Network Documentation",
        src: "img/shinzo-logo.svg",
        srcDark: "img/shinzo-logo-w.svg",
      },

      items: [
        {
          to: "/",
          activeBaseRegex: "^/$|^/introduction/",
          position: "left",
          label: "Introduction",
        },
        {
          to: "/indexers/overview",
          position: "left",
          label: "Indexers",
        },
        {
          to: "/hosts/overview",
          position: "left",
          label: "Hosts",
        },
        {
          to: "/views/overview",
          position: "left",
          label: "Views",
        },
        {
          to: "/guides/building-apps-with-shinzo",
          position: "left",
          label: "Guides",
        },
        {
          to: "/reference/architecture-overview",
          position: "left",
          label: "Reference",
        },
        {
          href: "https://github.com/shinzonetwork/",
          "aria-label": "GitHub repository",
          position: "right",
          className: "header-github-link",
        },
      ],
    },
    // Footer is rendered by src/theme/Footer/index.tsx (swizzled component).
    footer: {},
    prism: {
      theme: codeTheme,
    },
  } satisfies Preset.ThemeConfig,
  themes: ["@docusaurus/theme-mermaid"],

  plugins: [
    [
      "docusaurus-plugin-sass",
      {
        sassOptions: {
          includePaths: ["./src/css"],
        },
      },
    ],
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
        {
          hashed: true,
          language: ["en"],
          highlightSearchTermsOnTargetPage: true,
          explicitSearchResultPath: true,
          // Docs are served at the site root (see preset docs.routeBasePath: "/").
          // The search plugin defaults to "docs", which would filter out every page
          // and produce an empty search index. Mirror the docs route here.
          docsRouteBasePath: "/",
          indexBlog: false,
        },
    ],
    [
      "docusaurus-plugin-glossary",
      glossaryOptions,
    ],
    [
      "docusaurus-plugin-llms",
      {
        docsDir: "content",
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        excludeImports: true,
        removeDuplicateHeadings: true,
      },
    ],
  ],
};

export default config;
