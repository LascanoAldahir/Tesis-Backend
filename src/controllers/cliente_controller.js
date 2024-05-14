// IMPORTAR EL MODELO
import Cliente from "../models/Cliente.js"; // Importa el modelo Cliente para interactuar con la colección de pacientes en la base de datos
import Equipo from "../models/Equipo.js"; // Importa el modelo Equipo para interactuar con la colección de tratamientos en la base de datos

// IMPORTAR EL MÉTODO sendMailToPaciente
import { sendMailToCliente } from "../config/nodemailer.js"; // Importa la función sendMailToCliente desde el archivo nodemailer.js para enviar correos electrónicos

import mongoose from "mongoose"; // Importa mongoose para trabajar con la base de datos MongoDB
import generarJWT from "../helpers/crearJWT.js"; // Importa la función generarJWT desde el archivo crearJWT.js para generar tokens JWT

// Método para el proceso de login
const loginCliente = async(req,res)=>{
    const {email,password} = req.body // Extrae el email y la contraseña del cuerpo de la solicitud

    // Verifica si algún campo del cuerpo de la solicitud está vacío
    if (Object.values(req.body).includes("")) return res.status(404).json({msg:"Lo sentimos, debes llenar todos los campos"})

    // Busca un paciente en la base de datos por su email
    const clienteBDD = await Cliente.findOne({email})

    // Si no se encuentra ningún paciente con el email proporcionado, responde con un mensaje de error
    if(!clienteBDD) return res.status(404).json({msg:"Lo sentimos, el usuario no se encuentra registrado"})

    // Comprueba si la contraseña proporcionada coincide con la contraseña almacenada para el paciente en la base de datos
    const verificarPassword = await clienteBDD.matchPassword(password)

    // Si la contraseña no coincide, responde con un mensaje de error
    if(!verificarPassword) return res.status(404).json({msg:"Lo sentimos, el password no es el correcto"})

    // Genera un token JWT para el cliente
    const token = generarJWT(clienteBDD._id,"cliente")

    // Extrae algunos datos específicos del cliente para incluir en la respuesta
	const {nombre,propietario,email:emailP,celular,convencional,_id} = clienteBDD

    // Responde con un objeto JSON que contiene el token JWT y otros datos del paciente
    res.status(200).json({
        token,
        nombre,
        propietario,
        emailP,
        celular,
        convencional,
        rol:"cliente",
        _id
    })
}

// Método para ver el perfil 
const perfilCliente =(req,res)=>{
    // Elimina algunos campos sensibles del objeto pacienteBDD antes de responder
    delete req.clienteBDD.ingreso
    delete req.clienteBDD.detalle
    delete req.clienteBDD.salida
    delete req.clienteBDD.estado
    delete req.clienteBDD.tecnico
    delete req.clienteBDD.createdAt
    delete req.clienteBDD.updatedAt
    delete req.clienteBDD.__v
    // Responde con el perfil del cliente (sin los campos eliminados)
    res.status(200).json(req.clienteBDD)
}

// Método para listar pacientes
const listarClientes = async (req,res)=>{
    // Verifica si la solicitud contiene datos de clienteBDD
    if (req.clienteBDD && "propietario" in req.clienteBDD){
        // Si el pacienteBDD existe y es propietario, busca pacientes asociados a ese propietario
        const clientes = await Cliente.find(req.clienteBDD._id).select("-salida -createdAt -updatedAt -__v").populate('tecnico','_id nombre apellido')
        res.status(200).json(clientes)
    }
    else{
        // Si no es propietario, busca pacientes asociados al veterinarioBDD que hizo la solicitud
        const clientes = await Cliente.find({estado:true}).where('tecnico').equals(req.tecnicoBDD).select("-salida -createdAt -updatedAt -__v").populate('tecnico','_id nombre apellido')
        res.status(200).json(clientes)
    }
}

// Método para ver el detalle de un paciente en particular
const detalleCliente = async(req,res)=>{
    const {id} = req.params // Extrae el ID del paciente de los parámetros de la solicitud
    // Verifica si el ID es válido
    if( !mongoose.Types.ObjectId.isValid(id) ) return res.status(404).json({msg:`Lo sentimos, no existe el cliente ${id}`});
    // Busca al cliente por su ID y lo popula con la información del tecnico asociado y los equipos asociados
    const cliente = await Cliente.findById(id).select("-createdAt -updatedAt -__v").populate('tecnico','_id nombre apellido')
    const equipos = await Equipos.find({estado:true}).where('cliente').equals(id)
    // Responde con el detalle del cliente y sus equipos
    res.status(200).json({
        cliente,
        equipos
    })
}

// Método para registrar un paciente
const registrarCliente = async(req,res)=>{
    // desestructura el email
    const {email} = req.body
    // Valida todos los campos del cuerpo de la solicitud
    if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Lo sentimos, debes llenar todos los campos"})
    // Busca si el email ya está registrado en la base de datos
    const verificarEmailBDD = await Cliente.findOne({email})
    // Si el email ya está registrado, responde con un mensaje de error
    if(verificarEmailBDD) return res.status(400).json({msg:"Lo sentimos, el email ya se encuentra registrado"})
    // Crea una nueva instancia de Paciente con los datos proporcionados en el cuerpo de la solicitud
    const nuevoCliente = new Cliente(req.body)
    // Genera una contraseña aleatoria
    const password = Math.random().toString(36).slice(2)
    // Encripta la contraseña
    nuevoCliente.password = await nuevoCliente.encrypPassword("tec"+password)
    // Envía un correo electrónico al paciente con la contraseña
    await sendMailToCliente(email,"tec"+password)
    // Asocia el paciente con el tecnico que hizo la solicitud
    nuevoCliente.tecnico=req.tecnicoBDD._id
    // Guarda el cliente en la base de datos
    await nuevoCliente.save()
    // Responde con un mensaje de éxito
    res.status(200).json({msg:"Registro exitoso del cliente y correo enviado"})
}



// Método para actualizar un paciente
const actualizarCliente = async(req,res)=>{
    const {id} = req.params // Extrae el ID del paciente de los parámetros de la solicitud
    // Verifica si algún campo del cuerpo de la solicitud está vacío
    if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Lo sentimos, debes llenar todos los campos"})
    // Verifica si el ID del paciente es válido
    if( !mongoose.Types.ObjectId.isValid(id) ) return res.status(404).json({msg:`Lo sentimos, no existe el cliente ${id}`});
    // Busca y actualiza el paciente en la base de datos utilizando el ID proporcionado
    await Cliente.findByIdAndUpdate(req.params.id,req.body)
    // Responde con un mensaje de éxito
    res.status(200).json({msg:"Actualización exitosa del cliente"})
}

// Método para eliminar(dar de baja) un paciente
const eliminarCliente = async (req,res)=>{
    const {id} = req.params // Extrae el ID del paciente de los parámetros de la solicitud

    // Verifica si algún campo del cuerpo de la solicitud está vacío
    if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Lo sentimos, debes llenar todos los campos"})

    // Verifica si el ID del paciente es válido
    if( !mongoose.Types.ObjectId.isValid(id) ) return res.status(404).json({msg:`Lo sentimos, no existe el paciente ${id}`})

    const {salida} = req.body // Extrae la fecha de salida del cuerpo de la solicitud

    // Actualiza el paciente en la base de datos, estableciendo la fecha de salida y el estado en false
    await Cliente.findByIdAndUpdate(req.params.id,{salida:Date.parse(salida),estado:false})
    
    // Responde con un mensaje de éxito
    res.status(200).json({msg:"Fecha de salida del cliente registrada exitosamente"})
}

// Exporta los métodos de la API relacionados con la gestión de pacientes
export {
    loginCliente,
    perfilCliente,
    listarClientes,
    detalleCliente,
    registrarCliente,
    actualizarCliente,
    eliminarCliente
}