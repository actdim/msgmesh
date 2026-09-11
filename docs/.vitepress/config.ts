import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

const GITHUB_REPO = 'https://github.com/actdim/msgmesh';

export default withMermaid(
  defineConfig({
    base: '/msgmesh/',
    title: 'Message Mesh',
    description: 'High-performance, type-safe message mesh and event bus for TypeScript',
    cleanUrls: true,
    lastUpdated: true,
    ignoreDeadLinks: true,

    rewrites: {
      'INDEX.md': 'index.md'
    },

    markdown: {
      config: (md) => {
        const defaultRender =
          md.renderer.rules.link_open ||
          function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
          };

        md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
          const token = tokens[idx];
          const hrefIndex = token.attrIndex('href');
          if (hrefIndex >= 0) {
            const href = token.attrs![hrefIndex][1];
            if (href.startsWith('../')) {
              token.attrs![hrefIndex][1] = `${GITHUB_REPO}/blob/main/${href.slice(3)}`;
            }
          }
          return defaultRender(tokens, idx, options, env, self);
        };
      }
    },

    themeConfig: {
      nav: [
        { text: 'Home', link: '/' },
        { text: 'Overview', link: '/topic--01-overview-and-analysis' },
        { text: 'Architecture', link: '/topic--architecture' },
        { text: 'API Reference', link: '/topic--03-api-reference' },
        { text: 'License', link: '/topic--license' },
        { text: 'GitHub', link: GITHUB_REPO }
      ],

      sidebar: [
        {
          text: 'Overview & Index',
          items: [
            { text: 'Knowledge Base Index', link: '/' },
            { text: 'Problem Analysis & Overview', link: '/topic--01-overview-and-analysis' }
          ]
        },
        {
          text: 'Architecture & Specifications',
          items: [
            { text: 'Architecture & Types', link: '/topic--02-architecture-and-types' },
            { text: 'System Architecture', link: '/topic--architecture' },
            { text: 'Domain Model', link: '/topic--domain-model' }
          ]
        },
        {
          text: 'API & Advanced Patterns',
          items: [
            { text: 'API Reference', link: '/topic--03-api-reference' },
            { text: 'Advanced Patterns & Adapters', link: '/topic--04-advanced-patterns' }
          ]
        },
        {
          text: 'Development & Operations',
          items: [
            { text: 'Setup & Workflow', link: '/topic--setup-and-workflow' },
            { text: 'License', link: '/topic--license' }
          ]
        }
      ],

      search: {
        provider: 'local'
      },

      socialLinks: [
        { icon: 'github', link: GITHUB_REPO }
      ],

      editLink: {
        pattern: `${GITHUB_REPO}/edit/main/docs/:path`,
        text: 'Edit this page on GitHub'
      },

      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright (c) 2025-2026 actdim'
      }
    },

    mermaid: {
      theme: 'default'
    }
  })
);
