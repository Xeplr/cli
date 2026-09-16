import { useMemo } from 'react'
import { Routes, Route, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { authRoutes, authPath, NavPage, ProtectedRoute, useAccess } from '@xeplr/ui-account'
import Home from './pages/Home.jsx'
import Tasks from './pages/Tasks.jsx'
import EditTask from './pages/EditTask.jsx'
__WF_UI_IMPORTS__
import ConfigureUI from './pages/ConfigureUI.jsx'
import { FORM_MENU_PREFIX } from './menu.js'
import FormDesigner from './pages/FormDesigner.jsx'
import FormRecords from './pages/FormRecords.jsx'
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

const FormsIcon = (
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
// `key` is the menu row it matches (shown only to roles given that row); what
// people read is its label, changed in Configure UI → Menu.
const settingsOverrides = [
  { key: 'Admin', path: authPath('userRoles') },
  // Super Admin only (migrations-auth/0003): every form, and the side rail.
  { key: 'Configure UI', path: '/configure' }
]


// Layout route: NavPage and the routed page are independent siblings, and this
// holds no state of its own — lifting page state up here would re-render the
// nav on every unrelated change.
function Shell() {
  const navigate = useNavigate()

  const { access } = useAccess()
  const menus = (access && access.menus) || []

  // The drawer's catalog, by KEY. A key must match a `menus` row's name —
  // @xeplr/ui-account drops unknown keys SILENTLY, so a typo removes the item
  // with no error anywhere. The text shown is the row's label (Configure UI →
  // Menu), in the order set there — never written here.
  const drawerItems = useMemo(() => [
    { key: 'Home', icon: HomeIcon, clickHandler: () => navigate('/home') },
    { key: 'Tasks', icon: TasksIcon, clickHandler: () => navigate('/tasks') },
__MT_DRAWER_ITEM__
    // Every form added to the menu, with no code: "form:crop" opens /forms/crop.
    ...menus.filter((key) => key.startsWith(FORM_MENU_PREFIX)).map((key) => ({
      key, icon: FormsIcon, clickHandler: () => navigate('/forms/' + key.slice(FORM_MENU_PREFIX.length))
    }))
  ], [navigate, menus])

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
        {/* The task list opens its form on a page — see Tasks.jsx's onOpenRecord. */}
        <Route path="/tasks/new" element={<EditTask />} />
        <Route path="/tasks/:id" element={<EditTask />} />
        <Route path="/forms/:form" element={<FormRecords />} />
        <Route path="/configure" element={<ConfigureUI />} />
        <Route path="/configure/forms/:form/design/:part" element={<FormDesigner />} />
__WF_UI_ROUTES__
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  )
}
