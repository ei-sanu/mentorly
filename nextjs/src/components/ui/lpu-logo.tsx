import * as React from "react"

// Brand wordmark (formerly the LPU logo): plain sans 'Mentorly' in dark
// text, so it stays readable inside the white logo pills used on dark
// surfaces and matches the site-wide single sans stack. The export name
// is kept so existing imports don't break.
export function LpuLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <text
        x="4"
        y="29"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
        fontWeight="600"
        fontSize="27"
        fill="#171717"
        letterSpacing="-0.5"
      >
        Mentorly
      </text>
    </svg>
  )
}
