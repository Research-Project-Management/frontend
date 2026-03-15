import * as React from "react";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                gcTime: 5 * 60_000,
                refetchOnWindowFocus: false,
                retry: 1,
                placeholderData: keepPreviousData,
            }
        },
    });
}

// Export singleton so components can prefetch
let browserQueryClient: QueryClient | undefined;
export function getQueryClient() {
    if (!browserQueryClient) {
        browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [client] = React.useState(() => getQueryClient());
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
