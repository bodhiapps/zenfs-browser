import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Layer boundaries (see src/agent-kit/README.md and src/chat-ui/README.md).
// agent-kit must stay portable; chat-ui must not reach into adapters.
const AGENT_KIT_FORBIDDEN = [
  { group: ['react', 'react-dom', 'react/*', 'react-dom/*'], message: 'agent-kit must be framework-free. Move React code to src/chat-ui/.' },
  { group: ['@zenfs/*'], message: 'agent-kit must not depend on ZenFS. Put ZenFS code in src/adapters/browser/.' },
  { group: ['dexie', 'dexie/*'], message: 'agent-kit must not depend on Dexie. Put Dexie code in src/adapters/browser/.' },
  { group: ['@bodhiapp/*'], message: 'agent-kit must not depend on Bodhi SDKs. Wire transport at the app layer.' },
  { group: ['@/adapters/*', '@/chat-ui/*', '../adapters/*', '../../adapters/*', '../chat-ui/*', '../../chat-ui/*'], message: 'agent-kit cannot import from adapters/ or chat-ui/. Dependency direction is kit <- adapters and kit <- chat-ui.' },
]

const CHAT_UI_FORBIDDEN = [
  { group: ['@/adapters/*', '../adapters/*', '../../adapters/*'], message: 'chat-ui must not import from adapters/. The app wires adapters in via props/context.' },
  { group: ['@zenfs/*'], message: 'chat-ui must not import ZenFS directly. Go through a FileSystemProvider port.' },
  { group: ['dexie', 'dexie/*'], message: 'chat-ui must not import Dexie directly. Go through a ChatStore port.' },
]

export default defineConfig([
  globalIgnores(['dist', 'e2e']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/agent-kit/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: AGENT_KIT_FORBIDDEN }],
    },
  },
  {
    files: ['src/chat-ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: CHAT_UI_FORBIDDEN }],
    },
  },
])
