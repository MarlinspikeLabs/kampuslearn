import './globals.css';
import 'katex/dist/katex.min.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'KampusLearn — AI-Powered Academic Companion',
  description: 'Study smarter with AI tutoring, past questions, and CBT practice for Nigerian students.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                borderRadius: '8px',
                fontSize: '14px',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
