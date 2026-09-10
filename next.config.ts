import type { NextConfig } from "next";

/**
 * Two settings, both of them consequences of images living in Supabase Storage
 * rather than in the repository.
 */
const nextConfig: NextConfig = {
  /**
   * Hosts allowed to reach the dev server's own resources.
   *
   * The dev server announces itself as localhost, and Next blocks requests to
   * `/_next/*` dev endpoints from any other host — a real protection, since a
   * page in another tab could otherwise reach a dev server on this machine.
   * `127.0.0.1` is the same machine under a different name, so the block
   * applies to it too, and the casualty is the HMR WebSocket: it is refused,
   * the dev client never finishes starting, and **React never hydrates**. The
   * page renders perfectly and nothing on it responds to a click.
   *
   * This affects development only. It has no effect on `next build` or
   * `next start`, where there is no HMR socket and no dev endpoint to guard.
   *
   * Add a LAN address here too — the one `next dev` prints as "Network" — if
   * the portal is ever opened from a phone or another machine on the network.
   */
  allowedDevOrigins: ["127.0.0.1"],

  images: {
    /**
     * Product photographs, broker portraits and retailer logos are served from
     * the project's Storage host, so next/image has to be told that host is
     * allowed to be optimised. Scoped to Supabase's own domain over https and
     * to the public object path — not a blanket allow — so this cannot become
     * an open image proxy for arbitrary URLs.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  experimental: {
    serverActions: {
      /**
       * An upload is a server action, and server actions default to a 1 MB
       * body. The bucket accepts objects up to 5 MB, so without this a 2 MB
       * photograph would be rejected by the framework before any of the
       * portal's own validation — with a framework error rather than the
       * sentence a person needs to read. Slightly above 5 MB, so the limit
       * that actually refuses an oversized file is the portal's, which can
       * say why.
       */
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
