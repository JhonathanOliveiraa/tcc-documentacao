// Carga leve no frontend (Etapa 4 do Apêndice D): página inicial, config.json e deep link.
import http from 'k6/http';
import { check, sleep } from 'k6';
const BASE = __ENV.BASE_URL;
export const options = { vus: 3, duration: __ENV.DURACAO || '5m', thresholds: { http_req_failed: ['rate<0.01'] } };
export default function () {
  for (const p of ['/', '/config.json', '/produtos/1']) {
    check(http.get(`${BASE}${p}`), { '200': (r) => r.status === 200 });
  }
  sleep(1);
}
