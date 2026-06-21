import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// 1. Create the query client
const queryClient = new QueryClient();

// 2. Use hash history for local environments & Electron
const hashHistory = createHashHistory();

// 3. Create and export the 'router' variable exactly as main.tsx expects it
export const router = createRouter({
  routeTree,
  context: { queryClient },
  history: hashHistory,
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

// 4. Register the router type for global type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
