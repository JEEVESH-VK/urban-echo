export default function Spinner({ size = 'md', color = 'teal' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  const colors = { teal: 'border-teal-500', white: 'border-white', navy: 'border-[#1e3a5f]' }
  return (
    <div
      className={`${sizes[size]} border-2 ${colors[color]} border-t-transparent rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  )
}
