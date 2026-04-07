// taxUtils.ts
import { ItemDetail as PurchaseListItemDetail } from "@/Models/purchaseListModel"; // Renamed import
import { Item } from "@/Models/purchaseModel";
import { ItemDetails } from "@/Models/grnModel";
import { ItemDetail as ApItemDetail } from "@/Models/apModel"; // Renamed import

// Define the structure of the tax details
interface TaxDetails {
    sgstAmount: number;
    cgstAmount: number;
    igstAmount: number;
    additionalTaxAmounts: { [key: string]: number }; // To store any additional tax types
    totalTax: number;
}

export const calculateTaxAmounts = (items: Item[]): TaxDetails => {
    const totalTaxDetails: TaxDetails = {
        sgstAmount: 0,
        cgstAmount: 0,
        igstAmount: 0,
        additionalTaxAmounts: {},
        totalTax: 0,
    };

    items.forEach((item) => {
        const { taxPercentage, sgst, cgst, igst, additionalTaxes } = item;

        // Calculate total tax for the item based on its price
        const calculatedTaxAmount = (item.totalPrice * taxPercentage) / 100;

        // Handle SGST and CGST
        if (sgst !== null && cgst !== null) {
            const halfTax = calculatedTaxAmount / 2;
            totalTaxDetails.sgstAmount += halfTax;
            totalTaxDetails.cgstAmount += halfTax;
        }

        // Handle IGST
        if (igst !== null) {
            totalTaxDetails.igstAmount += calculatedTaxAmount;
        }

        // Handle additional tax types
        if (additionalTaxes) {
            Object.entries(additionalTaxes).forEach(([taxType, taxAmount]) => {
                if (!totalTaxDetails.additionalTaxAmounts[taxType]) {
                    totalTaxDetails.additionalTaxAmounts[taxType] = 0;
                }
                totalTaxDetails.additionalTaxAmounts[taxType] += taxAmount;
            });
        }

        totalTaxDetails.totalTax += calculatedTaxAmount; // Accumulate total tax amount
    });

    return totalTaxDetails;
};

export const formatTaxDetails = (taxDetails: TaxDetails) => {
    return {
        sgst: taxDetails.sgstAmount.toFixed(2),
        cgst: taxDetails.cgstAmount.toFixed(2),
        igst: taxDetails.igstAmount ? taxDetails.igstAmount.toFixed(2) : "N/A",
        additionalTaxes: Object.entries(taxDetails.additionalTaxAmounts).map(
            ([taxType, amount]) => ({
                taxType,
                amount: amount.toFixed(2),
            })
        ),
    };
};
