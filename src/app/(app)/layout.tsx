import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-forest-900 px-4 py-6 lg:flex lg:sticky lg:top-0 lg:h-screen">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold font-serif text-lg font-semibold text-white">
              A
            </div>
            <div>
              <div className="font-serif text-base font-semibold leading-tight text-cream">ADU Leads</div>
              <div className="text-xs text-forest-200">{BRAND.name}</div>
            </div>
          </div>
        </div>
        <Nav variant="sidebar" />
        <div className="mt-auto border-t border-forest-800 px-2 pt-4">
          <div className="truncate text-xs text-forest-200" title={user.email ?? ""}>
            {user.email}
          </div>
          <form action={signOut}>
            <button type="submit" className="mt-2 text-xs font-medium text-gold hover:text-gold-light">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 bg-forest-900 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="font-serif text-base font-semibold text-cream">ADU Leads</div>
          <form action={signOut}>
            <button type="submit" className="text-xs font-medium text-gold">
              Sign out
            </button>
          </form>
        </div>
        <Nav variant="mobile" />
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
