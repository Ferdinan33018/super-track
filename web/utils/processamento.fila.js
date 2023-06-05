const FilaCadastro = require('./fila.cadastro');

class ProcessamentoEmLote {
    constructor() {
      this.filaCadastro = new FilaCadastro();
    }
  
    adicionarObjeto(objeto) {
      this.filaCadastro.adicionar(objeto);
    }
  
    processar() {
      this.filaCadastro.processarFila();
    }
  }

module.exports = new ProcessamentoEmLote();
