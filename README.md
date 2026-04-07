## 本地启动步骤（快速参考）

### 终端 1（后端）
```bash
cd packages/backend
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

### 终端 2（前端）
```bash
cd packages/frontend
npm install
npm run dev
```

启动后访问：http://localhost:3002

---

---