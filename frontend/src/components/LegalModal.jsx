import React, { useState } from 'react';
import '../styles/LegalModal.css';

const LegalModal = ({ onClose }) => {
  const [tab, setTab] = useState('privacy');

  return (
    <div className="legal-overlay" onClick={onClose}>
      <div className="legal-modal" onClick={e => e.stopPropagation()}>
        <div className="legal-header">
          <div className="legal-tabs">
            <button className={`legal-tab ${tab === 'privacy' ? 'active' : ''}`} onClick={() => setTab('privacy')}>Privacy Policy</button>
            <button className={`legal-tab ${tab === 'terms' ? 'active' : ''}`} onClick={() => setTab('terms')}>Terms of Service</button>
          </div>
          <button className="legal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="legal-body">
          {tab === 'privacy' && (
            <div className="legal-content">
              <h2>Privacy Policy</h2>
              <p className="legal-updated">Last updated: March 2026</p>

              <h3>1. Introduction</h3>
              <p>Project Hub ("we", "our", "us") is a collaborative platform built for 42 School students as part of the ft_transcendence project. We are committed to protecting your privacy and handling your data responsibly. This policy explains what information we collect, how we use it, and your rights regarding your data.</p>

              <h3>2. Information We Collect</h3>
              <p><strong>2.1 Data from 42 OAuth</strong><br/>
              When you log in via 42 Intra, we receive and store: your 42 login, display name, email address, profile photo URL, campus, level, grade, wallet balance, correction points, and project completion data. This data is provided by the 42 API and is necessary for the application to function.</p>
              <p><strong>2.2 User-Provided Data</strong><br/>
              You may optionally provide: a custom nickname, a custom avatar image, friend connections, and team memberships. This data is provided voluntarily and can be modified or deleted at any time.</p>
              <p><strong>2.3 Automatically Collected Data</strong><br/>
              We collect basic connection logs including timestamps, IP addresses, and browser user-agent strings for security and debugging purposes. We do not use tracking cookies or analytics services.</p>

              <h3>3. How We Use Your Data</h3>
              <p>Your data is used exclusively to: authenticate you and maintain your session, display your profile and academic progress, enable team creation and collaboration features, manage friend connections, and provide real-time notifications. We do not sell, share, or transfer your data to any third parties. Your data is never used for advertising or marketing purposes.</p>

              <h3>4. Data Storage and Security</h3>
              <p>All data is stored in a PostgreSQL database within our Docker infrastructure. Passwords for local accounts are hashed using bcrypt with salt rounds. All connections are encrypted via HTTPS/TLS. Authentication tokens (JWT) are stored client-side and transmitted securely. Avatar images are stored as base64-encoded data in the database.</p>

              <h3>5. Data Retention</h3>
              <p>Your data is retained for the duration of your account's existence. Project and team data is retained as long as the associated teams exist. You may request deletion of your account and associated data at any time by contacting the project administrators.</p>

              <h3>6. Your Rights</h3>
              <p>You have the right to: access all personal data we store about you, modify your nickname and avatar at any time, remove friend connections, leave or delete teams, and request complete account deletion. To exercise these rights, use the in-app profile settings or contact the project team.</p>

              <h3>7. Third-Party Services</h3>
              <p>We integrate with the 42 Intra API for authentication and academic data synchronization. Please refer to 42's own privacy policy for information about how they handle your data. We use Bootstrap CSS loaded from a CDN, which may log standard HTTP request data. No other third-party services are used.</p>

              <h3>8. Changes to This Policy</h3>
              <p>We may update this privacy policy as the project evolves. Any significant changes will be communicated through the application. Continued use of Project Hub after changes constitutes acceptance of the updated policy.</p>

              <h3>9. Contact</h3>
              <p>For privacy-related questions or concerns, please contact the project team through 42 Intra or via the campus Slack channels.</p>
            </div>
          )}

          {tab === 'terms' && (
            <div className="legal-content">
              <h2>Terms of Service</h2>
              <p className="legal-updated">Last updated: March 2026</p>

              <h3>1. Acceptance of Terms</h3>
              <p>By accessing and using Project Hub, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you should not use the application. These terms apply to all users of the platform, including students and evaluators.</p>

              <h3>2. Description of Service</h3>
              <p>Project Hub is a collaborative web application designed for 42 School students. It provides: a dashboard for tracking academic progress and project completion, team creation and management for group projects, a friend system for connecting with peers, real-time notifications for team and friend activities, and a kanban board for project task management. The service is provided as part of the ft_transcendence project and is intended for educational purposes.</p>

              <h3>3. User Accounts</h3>
              <p><strong>3.1 Authentication</strong><br/>
              Access to Project Hub requires authentication through the 42 OAuth system. By logging in, you authorize us to access your 42 Intra profile data as described in our Privacy Policy.</p>
              <p><strong>3.2 Account Responsibility</strong><br/>
              You are responsible for maintaining the security of your session. Do not share your authentication tokens. You are responsible for all activities that occur under your account. Notify the project administrators immediately if you suspect unauthorized access.</p>

              <h3>4. Acceptable Use</h3>
              <p>You agree to use Project Hub responsibly and in accordance with 42 School's rules. You must not: upload malicious content or attempt to exploit the application, impersonate other users or misrepresent your identity, use the platform for purposes unrelated to 42 School activities, attempt to access other users' data without authorization, abuse the real-time notification system or spam other users, upload inappropriate or offensive avatar images, or create teams with misleading or offensive names.</p>

              <h3>5. Team Collaboration</h3>
              <p><strong>5.1 Team Creation</strong><br/>
              When creating a team, all invited members must accept the invitation before the team becomes active. Team names should be appropriate and relevant to the project.</p>
              <p><strong>5.2 Team Deletion</strong><br/>
              Team deletion requires approval from all team members through the deletion request system. This ensures no member is removed from a team without consent.</p>

              <h3>6. Content and Data</h3>
              <p>Academic data (projects, levels, grades) is synchronized from the 42 API and reflects your actual progress. Custom content you create (nicknames, avatars, team names) must comply with the acceptable use policy. We reserve the right to remove content that violates these terms.</p>

              <h3>7. Availability and Modifications</h3>
              <p>Project Hub is provided as an educational project. We do not guarantee uninterrupted availability or specific uptime. The service may be modified, updated, or discontinued as part of the project's development. Features may change without prior notice as the project evolves.</p>

              <h3>8. Limitation of Liability</h3>
              <p>Project Hub is provided "as is" without warranties of any kind. We are not liable for any data loss, service interruptions, or damages arising from use of the platform. This is a student project and should not be relied upon as a critical service.</p>

              <h3>9. Intellectual Property</h3>
              <p>The Project Hub source code is developed as part of the 42 School curriculum. All rights are subject to 42 School's policies regarding student projects. Third-party libraries and frameworks retain their respective licenses.</p>

              <h3>10. Termination</h3>
              <p>We reserve the right to suspend or terminate access for users who violate these terms. You may stop using the service at any time. Upon termination, your custom data (nickname, avatar) may be deleted, but team-related data may be retained for other team members.</p>

              <h3>11. Governing Rules</h3>
              <p>These terms are governed by 42 School's rules of procedure and applicable local regulations. Any disputes should be resolved through 42 School's internal processes.</p>

              <h3>12. Contact</h3>
              <p>For questions about these terms, please reach out to the project team through 42 Intra or campus communication channels.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegalModal;