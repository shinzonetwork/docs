import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { codeTheme } from "./src/code-theme";

const config: Config = {
  title: "Shinzō Developer Portal",
  tagline: "Build the Read Layer of Truth",
  url: "https://docs.shinzo.network",
  baseUrl: "/",
  favicon: "img/favicon.png",

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
          sidebarPath: "./sidebars.ts",
          sidebarCollapsible: true,
          sidebarCollapsed: true,
          editUrl: "https://github.com/shinzonetwork/web/tree/main/apps/docs/",
        },
        theme: {
          customCss: "./src/css/custom.scss",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    docs: {
      sidebar: {
        autoCollapseCategories: false,
      },
    },
    colorMode: {
      respectPrefersColorScheme: false,
      defaultMode: "light",
    },
    navbar: {
      title: null,
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
          to: "/docs/intro",
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
  ],
};

export default config;
