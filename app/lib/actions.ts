'use server';
import { z } from 'zod';
import { signIn } from '@/auth';
import postgres from 'postgres';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { revalidatePath } from 'next/cache';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}


const FromSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Customer ID is required',
    }),
    amount: z.coerce.number().gt(0, { message: 'Amount must be greater than 0' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Status is required',
    }),
    date: z.string()
})

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    },
    message?: string | null;
};


const CreateInvoice = FromSchema.omit({ id: true, date: true })
const UpdateInvoice = FromSchema.omit({ id: true, date: true })

export async function createInvoice(prevState: State, formdata: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formdata.get('customerId'),
        amount: formdata.get('amount'),
        status: formdata.get('status')
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES ( ${customerId}, ${amountInCents}, ${status}, ${date})
    `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, formdata: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formdata.get('customerId'),
        amount: formdata.get('amount'),
        status: formdata.get('status')
    });

    const amountInCents = amount * 100;
    await sql`
    UPDATE invoices 
    SET customer_id = ${customerId},
        amount = ${amountInCents},
        status = ${status}
    WHERE id = ${id}
    `

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    throw new Error('Failed to Delete Invoice');
    await sql`
    DELETE FROM invoices
    WHERE id = ${id}
    `
    revalidatePath('/dashboard/invoices');
}