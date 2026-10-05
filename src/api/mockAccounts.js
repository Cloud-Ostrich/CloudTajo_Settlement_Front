export const MOCK_ACCOUNTS = [
  { id: 1, email: 'user1@test.com', password: '1234', name: '김민서', role: 'USER' },
  { id: 2, email: 'user2@test.com', password: '1234', name: '이준호', role: 'USER' },
  { id: 3, email: 'admin@test.com', password: '1234', name: '관리자', role: 'ADMIN' },
];
export function publicUser({ id, email, name, role }) { return { id, email, name, role }; }
