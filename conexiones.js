import pkg from "pg";
import "dotenv/config";
const { Pool } = pkg;
const {
  POSTGRES_HOST,
  POSTGRES_PORT,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DATABASE,
} = process.env;

const connectionString = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`;

const config = {
  connectionString: connectionString,
  idleTimeoutMillis: 0,
  allowExitOnIdle: true,
};

export default class Conexion {
  static async registerTransaction(cuentaOrigen, cuentaDestino, fecha, monto) {
    if (!cuentaOrigen || !cuentaDestino || !fecha || !monto) {
      console.log(
        "Debes introducir una cuenta origen, una cuenta destino, una fecha y un monto",
      );
    } else {
      const pool = new Pool(config);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const descontar = {
          text: "UPDATE cuentas SET saldo = saldo - $2 WHERE id=$1 RETURNING *",
          values: [cuentaOrigen, monto],
        };
        const resultadoDescontar = await client.query(descontar);
        if (resultadoDescontar.rowCount === 0) {
          throw new Error("La cuenta origen no existe");
        }
        const acreditar = {
          text: "UPDATE cuentas SET saldo = saldo + $2 WHERE id=$1 RETURNING *",
          values: [cuentaDestino, monto],
        };

        const resultadoAcreditar = await client.query(acreditar);
        if (resultadoAcreditar.rowCount === 0) {
          throw new Error("La cuenta destino no existe");
        }

        const transferencia = {
          text: "INSERT INTO transferencias (descripcion,fecha,monto,cuenta_origen, cuenta_destino) VALUES ($1,$2,$3,$4,$5) RETURNING *",
          values: [
            `Transferencia entre ${cuentaOrigen} a ${cuentaDestino}`,
            fecha,
            monto,
            cuentaOrigen,
            cuentaDestino,
          ],
        };
        const transferenciaResult = await client.query(transferencia);
        console.log(transferenciaResult.rows[0]);

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        console.log(e.message);
      } finally {
        client.release();
      }
    }
  }

  static async getLastTenTransactionFromCuenta(cuenta) {
    if (!cuenta) {
      console.log("Debes introducir una cuenta");
    } else {
      const pool = new Pool(config);
      try {
        const consulta = {
          text: "SELECT * FROM transferencias WHERE cuenta_origen = $1 ORDER BY fecha desc LIMIT 10",
          values: [cuenta],
          rowMode: "array",
        };
        const result = await pool.query(consulta);
        console.log(result.rows);
        await pool.end();
      } catch (error) {
        console.log(error.message);
      }
    }
  }
  static async consultaCuenta(cuenta) {
    if (!cuenta) {
      console.log("Debes introducir una cuenta");
    } else {
      const pool = new Pool(config);
      try {
        const consulta = {
          text: "SELECT * FROM cuentas WHERE id = $1",
          values: [cuenta],
        };
        const result = await pool.query(consulta);
        if (result.rowCount === 0) {
          throw new Error("La cuenta no existe");
        }
        console.log(result.rows);
        await pool.end();
      } catch (error) {
        console.log(error.message);
      }
    }
  }
}
