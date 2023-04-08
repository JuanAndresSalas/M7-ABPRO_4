import express from "express"
import dotenv from "dotenv"
import pg from "pg"
import Cursor from "pg-cursor"


dotenv.config()

const app = express()

const {Pool} = pg

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    database: process.env.DATABASE
})

const client = await pool.connect()


app.listen(3000, ()=>{
    console.log("Server ok in port 3000")
})

let fecha = new Date
let fechaActual = `${fecha.getDate()}/${fecha.getMonth()}/${fecha.getFullYear()}`

let argumentos = process.argv.splice(2)
let accion = argumentos[0]
let datos = argumentos.splice(1)
let cliente = parseInt(datos[0])
let comprobarSaldo;
let saldo;
let desc;
switch(accion){
    case "registros":
        let text = "SELECT * fROM transacciones WHERE cuenta = $1"
        let id = datos[0]
        let values = [id]
       
        let cursor = client.query(new Cursor(text, values))

        cursor.read(10, (err, rows)=>{
            if(err){
                console.log(err)
            }else{

                if(rows.length == 0){
                    console.log("Cliente sin transacciones")
                }else{
                    console.table(rows)
                }
            }
        })
        
        break;
    case "giro":
        desc = parseInt(datos[1])
        comprobarSaldo = await pool.query("SELECT saldo from cuentas WHERE id = $1",[cliente])
        saldo = parseInt(comprobarSaldo.rows[0].saldo)
        
        if(saldo > desc){
            let saldoNuevo = saldo - desc
           
            await pool.query("BEGIN")
            try{
                await pool.query("UPDATE cuentas SET saldo = $2 WHERE id = $1",[cliente,saldoNuevo])
                
                let transaccion = ['giro',fechaActual,desc,cliente]
                let resultado = await pool.query(`INSERT INTO transacciones(descripcion,fecha,monto,cuenta) VALUES($1,$2,$3,$4) RETURNING *`,transaccion)
                await pool.query("COMMIT")
                console.table(resultado.rows)
            }catch(err){
                await pool.query("ROLLBACK")
                console.log(err)
            }
              
        }else {
            console.log("Saldo Insuficiente")
        }
        
        break;
    case "transferencia":

        comprobarSaldo = await pool.query("SELECT saldo from cuentas WHERE id = $1",[cliente])

        saldo = parseInt(comprobarSaldo.rows[0].saldo)

        let clienteDestino = parseInt(datos[1])
        let saldoClienteDestino = await pool.query("SELECT saldo from cuentas WHERE id = $1",[clienteDestino])
        saldoClienteDestino = parseInt(saldoClienteDestino.rows[0].saldo)
        desc = parseInt(datos[2])
        
        if(saldo > desc){
            await pool.query("BEGIN")
            try{
                let saldoNuevoCliente1 = saldo - desc
                let saldoNuevoCliente2 = saldoClienteDestino + desc

                await pool.query("UPDATE cuentas SET saldo = $2 WHERE id = $1",[cliente,saldoNuevoCliente1])
                await pool.query("UPDATE cuentas SET saldo = $2 WHERE id = $1",[clienteDestino,saldoNuevoCliente2])
                
                let transaccion1 = ["transferencia",fechaActual,desc,cliente]
                let transaccion2 = ["deposito",fechaActual,desc,clienteDestino]

                let resultado1 = await pool.query(`INSERT INTO transacciones(descripcion,fecha,monto,cuenta) VALUES($1,$2,$3,$4) RETURNING *`,transaccion1)
                let resultado2 = await pool.query(`INSERT INTO transacciones(descripcion,fecha,monto,cuenta) VALUES($1,$2,$3,$4) RETURNING *`,transaccion2)
                
                await pool.query("COMMIT")
                
                console.table(resultado1.rows)
                console.table(resultado2.rows)
            }catch(err){
                await pool.query("ROLLBACK")
                console.log(err)
            }
          
        }else {
            console.log("Saldo Insuficiente")
        }
        break;
    case "saldo":
        let saldoCliente = await pool.query("SELECT * from cuentas WHERE id = $1",[cliente])
        console.table(saldoCliente.rows)
        break;
    default:
        console.log("Acción inválida")
}

