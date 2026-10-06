import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · ADU Lead Tracker" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-forest-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold font-serif text-xl font-semibold text-white">
            A
          </div>
          <h1 className="font-serif text-2xl font-semibold text-cream">ADU Lead Tracker</h1>
          <p className="mt-1 text-sm text-forest-200">Internal team access only</p>
        </div>
        <div className="rounded-2xl bg-cream p-6 shadow-xl">
          <LoginForm next={next ?? ""} />
        </div>
      </div>
    </main>
  );
}
