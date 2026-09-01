import { Link } from 'react-router-dom';
import { Nav } from '../components/Nav';

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="container-x grid min-h-[60vh] place-items-center py-20 text-center">
        <div>
          <p className="font-display text-6xl font-semibold text-ink">404</p>
          <p className="mt-3 text-muted">That page wandered off. It happens.</p>
          <Link to="/" className="btn-primary mt-6">Back to the start</Link>
        </div>
      </main>
    </>
  );
}
