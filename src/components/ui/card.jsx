export function Card({ className='', ...props }) { return <div className={`card ${className}`} {...props}/> }
export function CardHeader({ className='', ...props }) { return <div className={`px-4 pt-4 ${className}`} {...props}/> }
export function CardTitle({ className='', ...props }) { return <h3 className={`text-lg font-semibold ${className}`} {...props}/> }
export function CardContent({ className='', ...props }) { return <div className={`p-4 pt-2 ${className}`} {...props}/> }
