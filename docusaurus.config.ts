import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { codeTheme } from "./src/code-theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const glossaryPlugin = require("docusaurus-plugin-glossary");

const glossaryOptions = {
  glossaryPath: "glossary/glossary.json",
  routePath: "/glossary",
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
          sidebarCollapsible: true,
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
    docs: {
      sidebar: {},
    },
    colorMode: {
      respectPrefersColorScheme: false,
      defaultMode: "light",
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
          type: "docSidebar",
          sidebarId: "shinzoSidebar",
          position: "left",
          label: "Get Started",
          className: "header-docs-link-shinzo",
        },
        {
          href: "https://github.com/shinzonetwork/",
          "aria-label": "GitHub repository",
          position: "right",
          className: "header-github-link",
        },
      ],
    },
    footer: {
  style: "light",
  logo: {
    alt: "Shinzo Logo",
    src: "img/shinzo-logo-footer.svg",
    srcDark: "img/shinzo-logo-footer-w.svg",
    href: "https://shinzo.network",
  },
  links: [
    {
      title: "Developers",
      items: [
        {
          label: "Getting Started",
          to: "/introduction/what-is-shinzo",
        },
        {
          label: "GitHub",
          href: "https://github.com/shinzonetwork",
        },
      ],
    },
    {
      title: "Community",
      items: [
        {
          label: "X",
          href: "https://x.com/shinzonetwork",
        },
        {
          label: "Discord",
          href: "https://discord.gg/shinzo",
        },
      ],
    },
    {
      title: "Resources",
      items: [
        {
          label: "Home",
          href: "https://shinzo.network/",
        },
        {
          label: "Blog",
          href: "https://medium.com/shinzo",
        },
      ],
    },
  ],
  copyright: `Copyright © ${new Date().getFullYear()} Shinzo. Built with Docusaurus.`,
  },
    prism: {
      theme: codeTheme,
    },
  } satisfies Preset.ThemeConfig,

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
          hashed:true,
          language: ["en"],
          highlightSearchTermsOnTargetPage: true,
          explicitSearchResultPath: true,
        },
    ],
    [
      "docusaurus-plugin-glossary",
      glossaryOptions,
    ],
  ],
};

export default config;
