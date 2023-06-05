
const axios = require('axios');
const { cadastrarObjetoComFila } = require('./fila.cadastro');

module.exports = {
    cadastrarListaEmLote: async function(url, data){
        cadastrarListaEmLote(url, data);
    }
}

// Função para cadastrar uma lista de objetos em lote
async function cadastrarListaEmLote(url, listaObjetos) {
    const promessas = listaObjetos.map(objeto => cadastrarObjeto(url, objeto));

    try {
        await Promise.all(promessas);
        console.log('Todos os objetos foram cadastrados em lote com sucesso!');
    } catch (error) { 
        console.error('Erro ao cadastrar objetos em lote:', error.message);
    }
}

// Função para cadastrar um objeto de forma assíncrona
async function cadastrarObjeto(url, objeto) {
    try {
        //const filaCadastro = new FilaCadastro();
        //filaCadastro.adicionar(objeto);
        cadastrarObjetoComFila(objeto);
        //const response = await axios.post(url, objeto);
        //console.log('Objeto cadastrado:', response.data);
    } catch (error) {
        console.error('Erro ao cadastrar objeto:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
}

