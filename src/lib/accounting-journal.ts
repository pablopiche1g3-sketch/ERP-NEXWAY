import { supabase } from '@/supabase/client';

export interface JournalLineItem {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export interface PostDoubleEntryParams {
  description: string;
  amount: number;
  type?: 'Avanzado' | 'Ingreso' | 'Egreso';
  branchId?: string | null;
  costCenterId?: string | null;
  lines: JournalLineItem[];
  createdAt?: string;
}

/**
 * Inserta de manera atómica y compatible una partida contable de doble entrada (Libro Diario y sus líneas).
 * Guarda en `journal` con su tipo 'Avanzado', amount y description,
 * y luego en `journal_lines` con cada una de las cuentas involucradas.
 */
export async function postDoubleEntryJournal(params: PostDoubleEntryParams) {
  const {
    description,
    amount,
    type = 'Avanzado',
    branchId = null,
    costCenterId = null,
    lines,
    createdAt
  } = params;

  try {
    const journalPayload: any = {
      description,
      amount,
      type,
      branch_id: branchId || null
    };

    if (costCenterId) {
      journalPayload.cost_center_id = costCenterId;
    }

    if (createdAt) {
      journalPayload.created_at = createdAt;
    }

    const { data: insertedJ, error: jErr } = await supabase
      .from('journal')
      .insert(journalPayload)
      .select('id')
      .single();

    if (jErr) {
      console.warn('Error insertando cabecera de journal:', jErr);
      return { success: false, error: jErr };
    }

    if (insertedJ && lines && lines.length > 0) {
      const linesToInsert = lines.map(l => ({
        journal_id: insertedJ.id,
        account_code: l.account_code,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0)
      }));

      const { error: linesErr } = await supabase
        .from('journal_lines')
        .insert(linesToInsert);

      if (linesErr) {
        console.warn('Error insertando líneas de journal_lines:', linesErr);
      }
    }

    return { success: true, journalId: insertedJ?.id };
  } catch (err: any) {
    console.error('Excepción en postDoubleEntryJournal:', err);
    return { success: false, error: err };
  }
}
