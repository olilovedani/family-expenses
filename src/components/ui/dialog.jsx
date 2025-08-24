import { useState } from 'react'
export function Dialog({ children }){ return <div>{children}</div> }
export function DialogTrigger({ asChild, children }){ return children }
export function DialogContent({ children }){ return <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/30"></div><div className="relative z-10 card p-4 max-w-lg w-[90%] bg-white">{children}</div></div> }
export function DialogHeader({ children }){ return <div className="mb-2">{children}</div> }
export function DialogTitle({ children }){ return <h4 className="font-semibold">{children}</h4> }
