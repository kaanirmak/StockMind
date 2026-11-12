package com.kaanirmak.stockmind;

import java.net.URI;

/** A URL prefix is not an origin. Keep this policy independent of Android for tests. */
public final class TrustedUrls {
    private static final String PRODUCTION_HOST = "stockmind.kaanrmak7.workers.dev";

    private TrustedUrls() {}

    public static boolean isTrusted(String value, String developmentOrigin, boolean debug) {
        try {
            URI uri = new URI(value);
            if (uri.getUserInfo() != null || uri.getHost() == null || value.indexOf('\\') >= 0) return false;
            if ("https".equalsIgnoreCase(uri.getScheme()) && PRODUCTION_HOST.equalsIgnoreCase(uri.getHost())
                    && effectivePort(uri) == 443) return true;
            // A user-configured HTTPS origin may be used for recovery/custom deployments.
            // It is accepted only for that exact configured origin, never as a broad host suffix.
            if (!debug && developmentOrigin != null) {
                URI configured = new URI(developmentOrigin);
                if (configured.getUserInfo() == null && configured.getHost() != null
                        && "https".equalsIgnoreCase(configured.getScheme())
                        && effectivePort(configured) == 443
                        && "https".equalsIgnoreCase(uri.getScheme())
                        && effectivePort(uri) == 443
                        && configured.getHost().equalsIgnoreCase(uri.getHost())) return true;
            }
            if (!debug || developmentOrigin == null) return false;
            URI dev = new URI(developmentOrigin);
            return dev.getUserInfo() == null && dev.getHost() != null
                    && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getScheme().equalsIgnoreCase(dev.getScheme())
                    && uri.getHost().equalsIgnoreCase(dev.getHost())
                    && effectivePort(uri) == effectivePort(dev);
        } catch (Exception ignored) {
            return false;
        }
    }

    private static int effectivePort(URI uri) {
        return uri.getPort() >= 0 ? uri.getPort() : ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80);
    }
}
