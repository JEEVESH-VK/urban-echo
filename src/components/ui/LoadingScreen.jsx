import { Building2 } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-3 text-white">
        <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
          <Building2 className="w-6 h-6" />
        </div>
        <span className="text-2xl font-bold">Urban Echo</span>
      </div>
      <div className="flex gap-2 mt-2">
        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}
