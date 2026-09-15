import { useMemo } from 'react'
import { Routes, Route, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { authRoutes, authPath, NavPage, ProtectedRoute } from '@xeplr/ui-account'
import Home from './pages/Home.jsx'
import Tasks from './pages/Tasks.jsx'
import Designer from './pages/Designer.jsx'
__MT_APP_UI_IMPORTS__

// The rail is ICON-ONLY when collapsed, so a drawer item without one is
// invisible until somebody widens the rail. Same 24x24 stroke language the
// account library's own icons use.
const TasksIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)

const DesignerIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
)

__MT_SWITCH_ICON__
const HomeIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </svg>
)

// Module-level (stable reference) so NavPage's memoization actually holds.
const notifications = { count: 0, onClick: () => {} }

// Rendered above the framework's built-in Profile / Change Password section.
const settingsOverrides = [
  { name: 'Admin', path: authPath('userRoles') }
]

// Layout route: NavPage and the routed page are independent siblings, and this
// holds no state of its own — lifting page state up here would re-render the
// nav on every unrelated change.
function Shell() {
  const navigate = useNavigate()

  // The drawer's catalog. A name here must match a seeded `menus` row —
  // @xeplr/ui-account drops unrecognised names SILENTLY, so a typo removes the
  // item with no error anywhere.
  const drawerItems = useMemo(() => [
    { name: 'Home', icon: HomeIcon, clickHandler: () => navigate('/home') },
    { name: 'Tasks', icon: TasksIcon, clickHandler: () => navigate('/tasks') },
    // Shown only to roles given the "Designer" menu (migrations-auth/0003).
    { name: 'Designer', icon: DesignerIcon, clickHandler: () => navigate('/designer') },
__MT_DRAWER_ITEM__
  ], [navigate])

  return (
    <div className="app">
      {/* SAMPLE LOGOS — replace public/logo.svg and public/logo-wide.svg with
          your own. `logo` is the small mark in the top bar and the collapsed
          rail; `expandedLogo` is the wider wordmark the rail swaps to when you
          widen it. */}
      <NavPage
        logo="/logo.svg"
        expandedLogo="/logo-wide.svg"
        notifications={notifications}
        settingsOverrides={settingsOverrides}
        drawerItems={drawerItems}
      />
      <main className="main"><Outlet /></main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* @xeplr/ui-account supplies every auth screen — login, register,
          forgot/reset password, activate, profile, change password, and the
          RBAC admin pages. We hand it our Shell so signed-in pages render in
          our own chrome. */}
      {authRoutes({}, { layout: <Shell /> })}

__MT_SELECT_ROUTE__
      <Route element={<ProtectedRoute>__MT_GATE_OPEN__<Shell />__MT_GATE_CLOSE__</ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/designer" element={<Designer />} />
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  )
}
