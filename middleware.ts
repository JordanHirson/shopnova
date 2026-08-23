import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // Lightweight authentication gate only. Admin *authorization* (role
    // check) is enforced server-side in every dashboard page and server
    // action via lib/auth/admin.ts — middleware alone is NOT trusted, because
    // Clerk v7 `auth.protect()` is deprecated and returns 404 under Next.js 16
    // (see PROJECT.md). The role lives in Clerk privateMetadata, which is not
    // available in the middleware JWT, so authorization must happen in-page.
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in?redirect_url=/dashboard", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
