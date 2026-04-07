export default function AuthLayout({ title, subtitle, children }: any) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-500 to-blue-600">
        {/* SAME IMAGE & TEXT – COPY FROM LOGIN */}
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2 text-center">{title}</h2>
          <p className="text-gray-600 text-center mb-6">{subtitle}</p>
          <div className="space-y-4">{children}</div>
          <div className="text-center mt-4">
            <a href="/login" className="text-sm text-gray-500 hover:underline">
              ← Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
