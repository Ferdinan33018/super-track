const axios = require('axios');


/**
 * Fila de cadastro de objetos de forma asincrona
 */
class FilaCadastro {

    constructor() {
        this.fila = [];
        this.processando = false;
    }

    adicionar(objeto) {
        //console.log('len: ', this.fila.length);
        this.fila.push(objeto);
        if (!this.processando) {
            this.processarFila();
        }
    }

    async processarFila() {
        if (this.fila.length === 0) {
            this.processando = false;
            console.log('A fila de cadastro está vazia.');
            return;
        }

        this.processando = true;
        const objeto = this.fila.shift();

        try {
            await this.realizarCadastro(objeto);
            //console.log('realizando cadastro...', objeto);
        } catch (error) {
            console.error('Erro ao cadastrar objeto:', error.message);
        }

        // Processar o próximo objeto da fila após um pequeno atraso
        // 750 ms para processamento medio de 400 itens em 300 seg
        setTimeout(async() => {
            await this.processarFila();
        }, 750);
    }

    async realizarCadastro(objeto) {
        try {
            const response = await axios.post('http://localhost:3001/tracks', objeto);
            //console.log('Objeto cadastrado:', response.status);
        } catch (error) {
            throw new Error(`Erro ao cadastrar objeto: ${error.message}`);
        }
    }
}


// Função para adicionar objetos na fila de cadastro
function adicionarObjetosNaFila() {
    // Adicione seus objetos aqui conforme necessário
    filaCadastro.adicionar({ nome: 'Objeto 1', valor: 10 });
    filaCadastro.adicionar({ nome: 'Objeto 2', valor: 20 });
    filaCadastro.adicionar({ nome: 'Objeto 3', valor: 30 });
}

// Chamada da função para adicionar objetos na fila de cadastro
//adicionarObjetosNaFila();


module.exports = FilaCadastro;