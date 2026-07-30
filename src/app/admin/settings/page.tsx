export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-gray-500">Platform configuration — coming soon.</p>
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Supabase Project</span>
          <span className="text-xs text-gray-500">wexnqxxjdzubtgqyedlm</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Region</span>
          <span className="text-xs text-gray-500">London (eu-west-2)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Player App</span>
          <a href="https://guesswhat-tan.vercel.app" target="_blank" className="text-xs text-orange-400 hover:underline">guesswhat-tan.vercel.app</a>
        </div>
      </div>
    </div>
  );
}
