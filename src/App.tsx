import { Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import CanvasRoute from "./pages/Canvas/index.tsx"

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<CanvasRoute />} />
        <Route path="*" element={<CanvasRoute />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </>
  )
}

export default App
