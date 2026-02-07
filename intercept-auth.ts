#!/usr/bin/env bun
/**
 * Intercept and log the authentication headers the Claude Agent SDK is using
 * Run this to see what credentials are being sent to Anthropic's API
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

// Patch fetch globally to intercept requests
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  const [url, init] = args;

  if (url.toString().includes('anthropic.com') || url.toString().includes('claude.ai')) {
    console.log('\n=== INTERCEPTED REQUEST ===');
    console.log('URL:', url.toString());
    console.log('Headers:', JSON.stringify(init?.headers || {}, null, 2));

    // Look for auth-related headers
    const headers = new Headers(init?.headers);
    console.log('\n=== AUTH HEADERS ===');
    console.log('x-api-key:', headers.get('x-api-key') || '(not set)');
    console.log('authorization:', headers.get('authorization') || '(not set)');
    console.log('anthropic-version:', headers.get('anthropic-version') || '(not set)');
    console.log('cookie:', headers.get('cookie') ? '(present - hidden for security)' : '(not set)');
    console.log('========================\n');
  }

  return originalFetch(...args);
};

// Run a minimal SDK query to trigger auth
async function main() {
  console.log('Starting minimal agent query to intercept auth...\n');

  try {
    const messages = query({
      prompt: async function* () {
        yield {
          type: "user",
          session_id: "test-session",
          parent_tool_use_id: null,
          message: { role: "user", content: "Say hello" },
        };
      },
      options: {
        cwd: process.cwd(),
        settingSources: ["user", "project"], // Same as beads-kanban agent-runner.ts
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      },
    });

    // Consume at least one message to trigger the API call
    for await (const msg of messages) {
      console.log('\nReceived message type:', msg.type);
      if (msg.type === 'assistant') {
        console.log('Got assistant response, auth interception complete!');
        break;
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
