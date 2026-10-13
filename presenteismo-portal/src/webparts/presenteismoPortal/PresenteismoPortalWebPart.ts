import * as React from 'react';
import * as ReactDom from 'react-dom';
import { DisplayMode, Version } from '@microsoft/sp-core-library';
import { type IPropertyPaneConfiguration, PropertyPaneSlider, PropertyPaneTextField } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import * as strings from 'PresenteismoPortalWebPartStrings';
import PresenteismoPortal from './components/PresenteismoPortal';
import type { IPortalProps, IServicos } from './components/tipos';
import { ADMIN_PADRAO } from './models';
import { AcessosService } from './services/AcessosService';
import { DadosService } from './services/DadosService';
import { HistoricoService } from './services/HistoricoService';
import { LancamentosService } from './services/LancamentosService';
import { PerfilService } from './services/PerfilService';
import { SpClient } from './services/SpClient';

export interface IPresenteismoPortalWebPartProps {
  titulo: string;
  subtitulo: string;
  frase: string;
  imagemBanner: string;
  adminEmail: string;
  intervaloAtualizacao: number;
  /** site onde ficam as listas (vazio = o site da página) */
  siteUrl: string;
}

/** Segundos entre as conferências de alterações: 0 desliga; padrão 15; mínimo 5. */
function intervaloValido(v: number | undefined): number {
  if (v === undefined || v === null || isNaN(Number(v))) return 15;
  const n = Math.round(Number(v));
  return n <= 0 ? 0 : Math.max(5, Math.min(300, n));
}

export default class PresenteismoPortalWebPart extends BaseClientSideWebPart<IPresenteismoPortalWebPartProps> {
  private _servicos: IServicos | undefined;
  private _chave: string = '';

  private _obterServicos(): IServicos {
    const site = (this.properties.siteUrl || this.context.pageContext.web.absoluteUrl).trim();
    if (!this._servicos || site !== this._chave) {
      this._chave = site;
      const sp = new SpClient(this.context.spHttpClient, site);
      this._servicos = {
        sp,
        dados: new DadosService(sp),
        acessos: new AcessosService(sp),
        lancamentos: new LancamentosService(sp),
        historico: new HistoricoService(sp),
        perfil: new PerfilService(sp)
      };
    }
    return this._servicos;
  }

  public render(): void {
    const user = this.context.pageContext.user;
    const element: React.ReactElement<IPortalProps> = React.createElement(PresenteismoPortal, {
      titulo: this.properties.titulo || 'QRA LATAM : Brasil',
      subtitulo: this.properties.subtitulo || 'Presenteísmo Digital Portal',
      frase: this.properties.frase || 'Presença hoje. Resultado sempre.',
      imagemBanner: (this.properties.imagemBanner || '').trim(),
      adminEmail: (this.properties.adminEmail || ADMIN_PADRAO).trim().toLowerCase(),
      intervaloAtualizacao: intervaloValido(this.properties.intervaloAtualizacao),
      usuario: { nome: user.displayName, email: (user.email || '').toLowerCase(), login: user.loginName || '' },
      servicos: this._obterServicos(),
      modoEdicao: this.displayMode === DisplayMode.Edit
    });
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected get disableReactivePropertyChanges(): boolean {
    return true;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.ExibicaoGroupName,
              groupFields: [
                PropertyPaneTextField('titulo', { label: strings.TituloLabel }),
                PropertyPaneTextField('subtitulo', { label: strings.SubtituloLabel }),
                PropertyPaneTextField('frase', { label: strings.FraseLabel }),
                PropertyPaneTextField('imagemBanner', { label: strings.ImagemBannerLabel, description: strings.ImagemBannerDescription })
              ]
            },
            {
              groupName: strings.AcessoGroupName,
              groupFields: [
                PropertyPaneTextField('adminEmail', {
                  label: strings.AdminEmailLabel,
                  description: strings.AdminEmailDescription
                })
              ]
            },
            {
              groupName: strings.AtualizacaoGroupName,
              groupFields: [
                PropertyPaneSlider('intervaloAtualizacao', {
                  label: strings.IntervaloAtualizacaoLabel,
                  min: 0,
                  max: 120,
                  step: 5,
                  showValue: true,
                  value: intervaloValido(this.properties.intervaloAtualizacao)
                })
              ]
            },
            {
              groupName: strings.FonteGroupName,
              groupFields: [PropertyPaneTextField('siteUrl', { label: strings.SiteUrlLabel, description: strings.SiteUrlDescription })]
            }
          ]
        }
      ]
    };
  }
}
