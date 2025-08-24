export function Table({ children }){ return <table>{children}</table> }
export function TableHeader({ children }){ return <thead>{children}</thead> }
export function TableBody({ children }){ return <tbody>{children}</tbody> }
export function TableRow({ children }){ return <tr>{children}</tr> }
export function TableHead({ className='', children }){ return <th className={className}>{children}</th> }
export function TableCell({ className='', children }){ return <td className={className}>{children}</td> }
