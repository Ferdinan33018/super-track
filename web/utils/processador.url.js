

class Observador { 
    constructor() {
        this.callbacks = [];
    }
    adicionarCallback(callback) {
        this.callbacks.push(callback);
    }
    notificar(url, resultado) {
        this.callbacks.forEach(callback => callback(url, resultado));
    }
}

class ProcessadorUrls {
 
    constructor(urls) {
        this.urls = urls;
        this.observador = new Observador();
    }

    processar() {
        this.urls.forEach(url => {
            // Simulando uma requisição assíncrona que leva algum tempo para ser concluída 
            setTimeout(() => {
                const resultado = `Dados da resposta da requisição para ${url}`;
                this.observador.notificar(url, resultado);
            },
                Math.random() * 3000);
        });
    }

    adicionarCallback(callback) {
        this.observador.adicionarCallback(callback);
    }
}


